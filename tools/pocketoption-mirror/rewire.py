#!/usr/bin/env python3
"""Offline pass: rewrite absolute self-references in mirrored HTML to local
root-absolute paths so the mirror is fully self-wired (no network needed)."""
import os, re, sys, threading, queue, time

ROOT='site/m.pocketoption.com'
HOSTS=['m.pocketoption.com','pocketoption.com','pocket-uploads.com','chat-po.site','widgets.moft.biz','static.moft.biz']
EXT={'pocket-uploads.com','chat-po.site','widgets.moft.biz','static.moft.biz'}

ATTR_RE=re.compile(r'''(\b(?:href|src|data-src|data-original|data-lazy|data-url|poster|action|srcset)\s*=\s*)(["'])(.*?)\2''', re.I|re.S)
CSS_URL_RE=re.compile(r'''url\(\s*(["']?)([^)"']+)\1\s*\)''', re.I)

host_alt='|'.join(re.escape(h) for h in HOSTS)
ABS_RE=re.compile(r'^(?:https?:)?//(?:'+host_alt+r')(/.*)?$', re.I)

def to_local(u):
    m=ABS_RE.match(u.strip())
    if not m: return None
    path=m.group(1) or '/'
    host=re.match(r'^(?:https?:)?//([^/]+)', u.strip(), re.I).group(1).lower()
    if host in EXT:
        path='/_ext/'+host+path
    if path.endswith('/') or path=='':
        path+='index.html'
    elif not os.path.splitext(path)[1]:
        path+='/index.html'
    return path

changed=[0]; lock=threading.Lock()

def do_file(fp):
    try:
        s=open(fp,encoding='utf-8',errors='ignore').read()
    except Exception: return
    orig=s
    def sub_attr(m):
        pre,q,val=m.group(1),m.group(2),m.group(3)
        if pre.lower().startswith('srcset'):
            parts=[]
            for part in val.split(','):
                toks=part.strip().split(' ')
                if toks and toks[0]:
                    loc=to_local(toks[0])
                    if loc: toks[0]=loc
                parts.append(' '.join(toks))
            return pre+q+','.join(parts)+q
        loc=to_local(val)
        if loc: return pre+q+loc+q
        return m.group(0)
    s=ATTR_RE.sub(sub_attr,s)
    def sub_css(m):
        q,val=m.group(1),m.group(2)
        loc=to_local(val)
        if loc: return 'url('+q+loc+q+')'
        return m.group(0)
    s=CSS_URL_RE.sub(sub_css,s)
    if s!=orig:
        open(fp,'w',encoding='utf-8').write(s)
        with lock: changed[0]+=1

files=[]
for dp,dn,fn in os.walk(ROOT):
    for f in fn:
        if f.endswith('.html'): files.append(os.path.join(dp,f))
print('html files:',len(files),flush=True)
q=queue.Queue()
for f in files: q.put(f)
def worker():
    while True:
        try: fp=q.get(timeout=5)
        except queue.Empty: return
        try: do_file(fp)
        except Exception: pass
        finally: q.task_done()
t0=time.time()
ths=[threading.Thread(target=worker,daemon=True) for _ in range(16)]
for t in ths: t.start()
q.join()
print('rewrote %d files in %.0fs'%(changed[0],time.time()-t0),flush=True)
