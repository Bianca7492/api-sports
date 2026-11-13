"""Fast proxy-rotating fetcher with per-proxy sessions + aggressive rotation."""
import requests, random, threading, time
from requests.adapters import HTTPAdapter
requests.packages.urllib3.disable_warnings()

UA='Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
HEADERS={'User-Agent':UA,
 'Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
 'Accept-Language':'en-US,en;q=0.9','Accept-Encoding':'gzip, deflate','Connection':'keep-alive'}

class Pool:
    def __init__(self, path='proxies_live.txt'):
        self.proxies=[]
        for line in open(path):
            line=line.strip()
            if line: self.proxies.append(line.split()[0])
        self.lock=threading.Lock()
        self.score={p:0 for p in self.proxies}
        self.dead=set()
        self.sessions={}
    def session(self, p):
        with self.lock:
            s=self.sessions.get(p)
            if s is None:
                s=requests.Session()
                a=HTTPAdapter(pool_connections=4, pool_maxsize=8, max_retries=0)
                s.mount('http://',a); s.mount('https://',a)
                s.proxies={'http':'http://'+p,'https':'http://'+p}
                s.headers.update(HEADERS)
                self.sessions[p]=s
            return s
    def next(self):
        with self.lock:
            live=[p for p in self.proxies if p not in self.dead]
            if not live: self.dead.clear(); live=list(self.proxies)
            live.sort(key=lambda p:-self.score.get(p,0))
            return random.choice(live[:max(12,len(live)//2)])
    def good(self,p):
        with self.lock: self.score[p]=self.score.get(p,0)+1
    def bad(self,p):
        with self.lock:
            self.score[p]=self.score.get(p,0)-3
            if self.score[p]<-9: self.dead.add(p)

POOL=Pool()

def fetch(url, tries=6, extra=None, allow=(200,), timeout=9, method='GET'):
    h=dict(HEADERS)
    if extra: h.update(extra)
    last=None
    for _ in range(tries):
        p=POOL.next()
        s=POOL.session(p)
        try:
            r=s.request(method,url,headers=h,timeout=(6,timeout),verify=False,allow_redirects=True)
            if r.status_code in allow:
                POOL.good(p); return r.status_code, r.content, r.headers.get('Content-Type',''), r.url
            last='HTTP %s'%r.status_code
            if r.status_code in (404,410): return r.status_code, b'', r.headers.get('Content-Type',''), r.url
            POOL.bad(p)
        except Exception as e:
            last=type(e).__name__; POOL.bad(p)
    return None,None,last,None
