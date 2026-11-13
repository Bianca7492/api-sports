#!/usr/bin/env python3
"""Mirror blog media served from pocketoption.com/api34/... into the local mirror.

Blog pages reference these both as root-relative (/api34/...) and absolute
(https://pocketoption.com/api34/...), so store the content at both local paths.
"""
import os, re, json, threading, queue, time, collections
import pf4, crawl2

ROOT='site/m.pocketoption.com'
REF_RE=re.compile(r'''(?:href|src|data-src|srcset)\s*=\s*["']([^"']+)["']''', re.I)
paths=set()
for dp,dn,fn in os.walk(ROOT):
    for f in fn:
        if not f.endswith('.html'): continue
        try: s=open(os.path.join(dp,f),encoding='utf-8',errors='ignore').read()
        except Exception: continue
        for m in REF_RE.finditer(s):
            v=m.group(1)
            for tok in re.split(r'[,\s]+', v):
                if '/api34/' in tok:
                    i=tok.find('/api34/')
                    paths.add(tok[i:])
paths=sorted(paths)
print('distinct api34 paths:', len(paths), flush=True)
json.dump(paths, open('/tmp/api34_paths.json','w'))

lock=threading.Lock(); q=queue.Queue()
for p in paths: q.put(p)
stats=collections.Counter(); t0=time.time()

def worker():
    while True:
        try: p=q.get(timeout=10)
        except queue.Empty: return
        try:
            st,data,ct,f=pf4.fetch('https://pocketoption.com'+p, tries=8, timeout=16)
            if not data:
                with lock: stats[str(st)]+=1
                continue
            for local in (p, '/_ext/pocketoption.com'+p):
                fp=os.path.join(ROOT, local.lstrip('/'))
                os.makedirs(os.path.dirname(fp), exist_ok=True)
                with open(fp,'wb') as fh: fh.write(data)
            with lock:
                stats['200']+=1
                n=sum(stats.values())
                if n%200==0:
                    print('[%d] ok=%d dead=%d %.1f/s %s'%(n,stats['200'],stats.get('404',0),n/(time.time()-t0),p),flush=True)
        except Exception as e:
            with lock: stats['err']+=1
        finally: q.task_done()

ths=[threading.Thread(target=worker,daemon=True) for _ in range(150)]
for t in ths: t.start()
q.join()
print('DONE', stats.most_common(), flush=True)
