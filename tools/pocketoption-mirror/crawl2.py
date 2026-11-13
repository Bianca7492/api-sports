#!/usr/bin/env python3
"""High-throughput resumable mirror of m.pocketoption.com via proxy pool.

BFS over same-host refs from every language root; rewrites refs to
root-absolute local paths; stores pages+assets; resumable via state file.
"""
import os, re, sys, json, threading, queue, time
from urllib.parse import urljoin, urlparse, unquote
import pf4

ORIGIN = 'https://m.pocketoption.com'
ROOT = os.environ.get('MIRROR_ROOT', 'site/m.pocketoption.com')
STATE = os.environ.get('CRAWL_STATE', '/tmp/c2state.json')
os.makedirs(ROOT, exist_ok=True)

SELF_HOSTS = {'m.pocketoption.com'}
EXT_HOSTS = {'pocket-uploads.com', 'chat-po.site', 'widgets.moft.biz', 'static.moft.biz'}
LOCAL_HOSTS = SELF_HOSTS | EXT_HOSTS

ATTR_RE = re.compile(r'''(\b(?:href|src|data-src|data-original|data-lazy|data-url|poster|action|srcset)\s*=\s*)(["'])(.*?)\2''', re.I | re.S)
CSS_URL_RE = re.compile(r'''url\(\s*(["']?)([^)"']+)\1\s*\)''', re.I)
SKIP = ('#', 'data:', 'mailto:', 'tel:', 'javascript:', 'blob:', 'about:', 'ws:', 'wss:')


def norm(u, base):
    try:
        return urljoin(base, (u or '').strip())
    except Exception:
        return None


def local_url(url):
    p = urlparse(url)
    host = p.netloc.lower()
    path = unquote(p.path)
    if host and host not in SELF_HOSTS:
        path = '/_ext/' + host + path
    if path.endswith('/') or path == '':
        path += 'index.html'
    elif not os.path.splitext(path)[1]:
        path += '/index.html'
    if p.query:
        q = re.sub(r'[^A-Za-z0-9._-]', '_', p.query)[:80]
        r, e = os.path.splitext(path)
        path = r + '@' + q + e
    return path


def local_path(url):
    return os.path.join(ROOT, local_url(url).lstrip('/'))


def is_page(url, ct):
    if ct and 'html' in ct:
        return True
    path = urlparse(url).path
    return path.endswith('/') or not os.path.splitext(path)[1]


class Crawler:
    def __init__(self, workers=300):
        self.workers = workers
        self.lock = threading.RLock()
        self.q = queue.Queue()
        self.seen = set()
        self.pages = {}
        self.assets = {}
        self.failed = {}
        self.count = 0
        self.stop = threading.Event()
        self.load()

    def load(self):
        if os.path.exists(STATE):
            try:
                d = json.load(open(STATE))
                self.seen = set(d.get('seen', []))
                self.pages = d.get('pages', {})
                self.assets = d.get('assets', {})
                self.failed = d.get('failed', {})
                print('resumed: seen=%d pages=%d assets=%d failed=%d'
                      % (len(self.seen), len(self.pages), len(self.assets), len(self.failed)), flush=True)
            except Exception as e:
                print('state load failed:', e, flush=True)

    def save(self):
        with self.lock:
            tmp = STATE + '.tmp'
            json.dump({'seen': list(self.seen), 'pages': self.pages,
                       'assets': self.assets, 'failed': self.failed}, open(tmp, 'w'))
            os.replace(tmp, STATE)

    def worker(self):
        while not self.stop.is_set():
            try:
                url = self.q.get(timeout=10)
            except queue.Empty:
                continue
            try:
                self.process(url)
            except Exception as e:
                with self.lock:
                    self.failed[url] = 'err:' + str(e)[:80]
            finally:
                self.q.task_done()

    def process(self, url):
        with self.lock:
            if url in self.seen:
                return
            self.seen.add(url)
        st, data, ct, final = pf4.fetch(url, tries=5)
        if not data:
            with self.lock:
                self.failed[url] = st
            return
        page = is_page(url, ct)
        orig_html = data.decode('utf-8', 'replace') if page else None
        if page:
            data = self.rewrite(orig_html, url).encode('utf-8')
        lp = local_path(url)
        parts = lp.split(os.sep)
        for k in range(1, len(parts)):
            anc = os.sep.join(parts[:k])
            if os.path.isfile(anc):
                try:
                    os.rename(anc, anc + '.html')
                except Exception:
                    pass
        try:
            os.makedirs(os.path.dirname(lp), exist_ok=True)
            with open(lp, 'wb') as f:
                f.write(data)
        except Exception as e:
            with self.lock:
                self.failed[url] = 'write:' + str(e)[:60]
            return
        with self.lock:
            (self.pages if page else self.assets)[url] = st
            self.count += 1
            n = self.count
        if n % 100 == 0:
            print('[%d] pages=%d assets=%d fail=%d q=%d %s'
                  % (n, len(self.pages), len(self.assets), len(self.failed), self.q.qsize(), url), flush=True)
            self.save()
        if page:
            for child in self.extract_refs(orig_html, url):
                with self.lock:
                    if child not in self.seen:
                        self.q.put(child)

    def extract_refs(self, html, base):
        urls = set()
        for m in ATTR_RE.finditer(html):
            val = m.group(3)
            if m.group(1).lower().startswith('srcset'):
                for part in val.split(','):
                    u = part.strip().split(' ')[0]
                    if u:
                        urls.add(u)
            else:
                urls.add(val)
        for m in CSS_URL_RE.finditer(html):
            urls.add(m.group(2))
        out = []
        for r in urls:
            r = r.strip()
            if not r or r.startswith(SKIP):
                continue
            u = norm(r, base)
            if not u:
                continue
            p = urlparse(u)
            if p.scheme not in ('http', 'https'):
                continue
            if p.netloc.lower() in LOCAL_HOSTS:
                out.append(u)
        return out

    def rewrite(self, html, page_url):
        def sub(m):
            prefix, q, val = m.group(1), m.group(2), m.group(3)
            if prefix.lower().startswith('srcset'):
                parts = []
                for part in val.split(','):
                    toks = part.strip().split(' ')
                    if toks and toks[0]:
                        u = norm(toks[0], page_url)
                        if u and urlparse(u).netloc.lower() in LOCAL_HOSTS:
                            toks[0] = local_url(u)
                    parts.append(' '.join(toks))
                return prefix + q + ','.join(parts) + q
            if val.strip().startswith(SKIP):
                return m.group(0)
            u = norm(val, page_url)
            if not u:
                return m.group(0)
            if urlparse(u).netloc.lower() in LOCAL_HOSTS:
                return prefix + q + local_url(u) + q
            return m.group(0)
        html = ATTR_RE.sub(sub, html)

        def subcss(m):
            q, val = m.group(1), m.group(2)
            if val.strip().startswith(('data:', '#')):
                return m.group(0)
            u = norm(val, page_url)
            if u and urlparse(u).netloc.lower() in LOCAL_HOSTS:
                return 'url(' + q + local_url(u) + q + ')'
            return m.group(0)
        return CSS_URL_RE.sub(subcss, html)

    def crawl(self, seeds):
        for s in seeds:
            with self.lock:
                if s not in self.seen:
                    self.q.put(s)
        ths = [threading.Thread(target=self.worker, daemon=True) for _ in range(self.workers)]
        for t in ths:
            t.start()
        last = -1
        stall = 0
        while True:
            time.sleep(10)
            n = len(self.pages) + len(self.assets)
            if n == last:
                stall += 1
                if stall >= 6 and self.q.qsize() == 0:
                    break
            else:
                stall = 0
                last = n
            print('... progress pages=%d assets=%d fail=%d q=%d'
                  % (len(self.pages), len(self.assets), len(self.failed), self.q.qsize()), flush=True)
            self.save()
        self.stop.set()
        self.save()
        print('DONE pages=%d assets=%d failed=%d' % (len(self.pages), len(self.assets), len(self.failed)), flush=True)


if __name__ == '__main__':
    seeds = sys.argv[1:]
    if not seeds:
        langs = json.load(open('/tmp/langs.json'))
        seeds = [ORIGIN + '/%s/' % l for l in langs]
    c = Crawler(workers=int(os.environ.get('WORKERS', '300')))
    c.crawl(seeds)
