#!/usr/bin/env python3
"""Robust filler: fetch a URL list with many tries, multi-round retry for
transient failures, and a final classification of genuinely-404 routes."""
import json, os, sys, threading, queue, time, collections
import crawl2, pf4

urls=json.load(open(sys.argv[1]))
c=crawl2.Crawler(workers=1)
lock=threading.Lock()
round_no=[0]
status={}   # url -> code or 'dead'

def fetch_one(url):
    st,data,ct,final=pf4.fetch(url, tries=10, timeout=14)
    if data:
        page=crawl2.is_page(url,ct)
        if page:
            data=c.rewrite(data.decode('utf-8','replace'),url).encode('utf-8')
        lp=crawl2.local_path(url)
        parts=lp.split(os.sep)
        for k in range(1,len(parts)):
            anc=os.sep.join(parts[:k])
            if os.path.isfile(anc):
                try: os.rename(anc,anc+'.html')
                except Exception: pass
        os.makedirs(os.path.dirname(lp),exist_ok=True)
        open(lp,'wb').write(data)
        return 200
    return st

def run(batch, workers=150):
    q=queue.Queue()
    for u in batch: q.put(u)
    res={}
    def worker():
        while True:
            try: url=q.get(timeout=10)
            except queue.Empty: return
            try:
                res[url]=fetch_one(url)
            except Exception as e:
                res[url]='err'
            finally: q.task_done()
    ths=[threading.Thread(target=worker,daemon=True) for _ in range(workers)]
    for t in ths: t.start()
    q.join()
    return res

remaining=list(urls)
for rnd in range(6):
    round_no[0]=rnd
    print('ROUND %d: %d urls'%(rnd,len(remaining)),flush=True)
    t0=time.time()
    res=run(remaining)
    for u,st in res.items(): status[u]=st
    ok=sum(1 for v in res.values() if v==200)
    dead=[u for u,v in res.items() if v==404]
    trans=[u for u,v in res.items() if v not in (200,404)]
    print('  ok=%d dead404=%d transient=%d (%.0fs)'%(ok,len(dead),len(trans),time.time()-t0),flush=True)
    c.save()
    remaining=trans
    if not remaining: break

json.dump({u:str(v) for u,v in status.items()}, open('/tmp/fill_status.json','w'))
print('FINAL:', collections.Counter(str(v) for v in status.values()).most_common(),flush=True)
