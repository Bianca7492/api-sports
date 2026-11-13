import os, re, json, collections
from urllib.parse import unquote
ROOT='site/m.pocketoption.com'
REF_RE=re.compile(r'''(?:href|action|src)\s*=\s*["']([^"']+)["']''', re.I)
def exists(p):
    rel=unquote(p).lstrip('/'); cand=os.path.join(ROOT, rel)
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
            if '{' in u or '}' in u or '@' in u: continue
            u=u.split('?')[0].split('#')[0]
            if u.startswith('/_ext/'): continue
            refs.add(unquote(u))
missing=[p for p in refs if not exists(p)]
out={'referenced':len(refs),'missing':len(missing),
     'coverage':round(100*(len(refs)-len(missing))/len(refs),2)}
c=collections.Counter()
for p in missing:
    c['reviews/N' if re.match(r'^/[a-z]{2}/reviews/\d+/',p) else ('blog' if '/blog/' in p else ('api34' if '/api34/' in p else 'other'))]+=1
out['breakdown']=dict(c)
json.dump(out, open('/tmp/final_cov.json','w'), indent=1)
print(json.dumps(out, indent=1))
