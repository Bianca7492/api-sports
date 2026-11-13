#!/usr/bin/env python3
"""Fetch remaining gaps: normal origin URLs, plus api34 media from the main domain."""
import os, json, threading, queue, time, collections
import pf4, crawl2

urls=json.load(open('/tmp/theme_fetch.json'))
ROOT='site/m.pocketoption.com'
c=crawl2.Crawler(workers=1)
lock=threading.Lock(); stats=collections.Counter()

def store(local_path, data):
    fp=os.path.join(ROOT, local_path.lstrip('/'))
    os.makedirs(os.path.dirname(fp), exist_ok=True)
    open(fp,'wb').write(data)

def one(u):
    if '/api34/' in u:
        p=u[u.find('/api34/'):]
        st,data,ct,f=pf4.fetch('https://pocketoption.com'+p, tries=8, timeout=16)
        if data:
            store(p, data); store('/_ext/pocketoption.com'+p, data)
            return 200
        return st
    st,data,ct,f=pf4.fetch(u, tries=8, timeout=16)
    if not data: return st
    page=crawl2.is_page(u,ct)
    if page:
        data=c.rewrite(data.decode('utf-8','replace'),u).encode('utf-8')
    store(crawl2.local_url(u), data)
    return 200

q=queue.Queue()
for u in urls: q.put(u)
def worker():
    while True:
        try: u=q.get(timeout=10)
        except queue.Empty: return
        try:
            r=one(u)
            with lock:
                stats[str(r)]+=1
                if stats['200']%10==0: print('[%d] %s'%(stats['200'],u),flush=True)
        except Exception as e:
            with lock: stats['err']+=1
        finally: q.task_done()
ths=[threading.Thread(target=worker,daemon=True) for _ in range(40)]
for t in ths: t.start()
q.join()
print('DONE',stats.most_common(),flush=True)
