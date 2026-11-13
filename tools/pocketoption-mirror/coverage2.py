#!/usr/bin/env python3
"""Coverage of distinct (lang, path) routes, ignoring per-user query variants."""
import os, re, json, collections
from urllib.parse import unquote

ROOT='site/m.pocketoption.com'
REF_RE=re.compile(r'''(?:href|action|src)\s*=\s*["']([^"']+)["']''', re.I)

def exists(p):
    rel=unquote(p).lstrip('/')
    cand=os.path.join(ROOT, rel)
    return (os.path.isfile(cand) or os.path.isfile(cand+'.html')
            or os.path.isfile(os.path.join(cand,'index.html')))

refs=set()
for dp,dn,fn in os.walk(ROOT):
    for f in fn:
        if not f.endswith('.html'): continue
        try: s=open(os.path.join(dp,f),encoding='utf-8',errors='ignore').read()
        except Exception: continue
        for m in REF_RE.finditer(s):
            u=m.group(1).strip()
            if not u.startswith('/') or u.startswith('//'): continue
            if '{' in u or '}' in u: continue
            u=u.split('?')[0].split('#')[0]
            if u.startswith('/_ext/'): continue
            refs.add(unquote(u))

# distinct (lang, path) routes
routes=set()
for p in refs:
    seg=[x for x in p.split('/') if x]
    if not seg: continue
    lang=seg[0] if len(seg[0])==2 else None
    tmpl='/'+'/'.join(seg[1:]) if lang else p
    routes.add((lang or '', tmpl))
print('distinct internal routes (lang,path):', len(routes))
print('distinct paths (no lang):', len(set(t for _,t in routes)))

missing=[p for p in refs if not exists(p)]
print('missing referenced paths (raw):', len(missing))
# group missing by lang
langs=collections.Counter()
for p in missing:
    seg=[x for x in p.split('/') if x]
    langs[seg[0] if seg and len(seg[0])==2 else '(root)']+=1
print('missing by lang:', langs.most_common(12))
# templates missing for en
en_missing=sorted(p for p in missing if p.startswith('/en/'))
print('missing /en/* :', len(en_missing))
for p in en_missing[:40]: print('   ', p)
json.dump(missing, open('/tmp/cov2_missing.json','w'))
