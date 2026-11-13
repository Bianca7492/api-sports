#!/usr/bin/env python3
"""BFS closure over /blog/ routes (and their api34 media), fetching anything
referenced but not yet mirrored, until the queue drains."""
import os, re, json, threading, queue, time, collections
import pf4, crawl2

ROOT='site/m.pocketoption.com'
c=crawl2.Crawler(workers=1)
REF_RE=re.compile(r'''(?:href|action)\s*=\s*["']([^"']+)["']''', re.I)
API34_RE=re.compile(r'/api34/[^"\')\s,\\]+')

def local(p):
    if p.endswith('/'): return os.path.join(ROOT, p.lstrip('/'), 'index.html')
    return os.path.join(ROOT, p.lstrip('/'))

def exists(p):
    return os.path.isfile(local(p)) or os.path.isfile(os.path.join(ROOT,p.lstrip('/')))

# seed: all referenced blog routes not present
seeds=set()
for dp,dn,fn in os.walk(ROOT):
    for f in fn:
        if not f.endswith('.html'): continue
        try: s=open(os.path.join(dp,f),encoding='utf-8',errors='ignore').read()
        except: continue
        for m in REF_RE.finditer(s):
            u=m.group(1).strip().split('?')[0].split('#')[0]
            if u.startswith('/blog/') and '@' not in u and '{' not in u:
                seeds.add(u)
todo=[p for p in seeds if not exists(p)]
print('seed missing blog routes:',len(todo),flush=True)

lock=threading.Lock()
seen=set(todo)
q=queue.Queue()
for p in todo: q.put(p)
stats=collections.Counter(); api=set()

def extract_blog_refs(html):
    out=set()
    for m in REF_RE.finditer(html):
        u=m.group(1).strip().split('?')[0].split('#')[0]
        if u.startswith('/blog/') and '@' not in u and '{' not in u:
            out.add(u)
    return out

def worker():
    while True:
        try: p=q.get(timeout=15)
        except queue.Empty: return
        try:
            st,data,ct,f=pf4.fetch('https://m.pocketoption.com'+p, tries=6, timeout=16)
            if not data:
                with lock: stats['dead' if st==404 else 'trans']+=1
                continue
            html=data.decode('utf-8','replace')
            data=c.rewrite(html,p).encode('utf-8')
            fp=local(p); os.makedirs(os.path.dirname(fp),exist_ok=True); open(fp,'wb').write(data)
            with lock: stats['ok']+=1
            for im in API34_RE.finditer(html): api.add(im.group(0))
            for r in extract_blog_refs(html):
                with lock:
                    if r not in seen:
                        seen.add(r)
                        if not exists(r): q.put(r)
        except Exception:
            with lock: stats['err']+=1
        finally: q.task_done()

t0=time.time()
ths=[threading.Thread(target=worker,daemon=True) for _ in range(120)]
for t in ths: t.start()
q.join()
print('BFS done', stats.most_common(), '%.0fs'%(time.time()-t0),flush=True)

# now fetch any api34 media referenced but missing
mp=[p for p in api if not exists(p)]
print('api34 media missing:',len(mp),flush=True)
mq=queue.Queue()
for p in mp: mq.put(p)
def mworker():
    while True:
        try: p=mq.get(timeout=15)
        except queue.Empty: return
        try:
            st,data,ct,f=pf4.fetch('https://pocketoption.com'+p, tries=8, timeout=16)
            if data:
                for lp in (p, '/_ext/pocketoption.com'+p):
                    fp=os.path.join(ROOT,lp.lstrip('/')); os.makedirs(os.path.dirname(fp),exist_ok=True); open(fp,'wb').write(data)
                with lock: stats['img']+=1
        except Exception: pass
        finally: mq.task_done()
ths=[threading.Thread(target=mworker,daemon=True) for _ in range(120)]
for t in ths: t.start()
mq.join()
print('DONE', stats.most_common(),flush=True)
