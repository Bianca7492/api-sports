import os,re,json,collections
ROOT='site/m.pocketoption.com'
REF_RE=re.compile(r'''(?:href|action)\s*=\s*["']([^"']+)["']''', re.I)
rev=set()
for dp,dn,fn in os.walk(ROOT):
    for f in fn:
        if not f.endswith('.html'): continue
        try: s=open(os.path.join(dp,f),encoding='utf-8',errors='ignore').read()
        except: continue
        for mm in REF_RE.finditer(s):
            u=mm.group(1).strip().split('?')[0].split('#')[0]
            if '@' in u or '{' in u: continue
            m2=re.match(r'^/([a-z]{2})/reviews/(\d+)(?:/index\.html)?/?$', u)
            if m2: rev.add((m2.group(1),int(m2.group(2))))
def exists(l,n):
    return os.path.isfile(os.path.join(ROOT,l,'reviews',str(n),'index.html'))
miss=sorted((l,n) for l,n in rev if not exists(l,n))
print('review refs:',len(rev),'missing:',len(miss))
print('missing by lang:',collections.Counter(l for l,n in miss).most_common())
print('samples:',miss[:12])
json.dump([[l,n] for l,n in miss], open('/tmp/rev_missing.json','w'))
