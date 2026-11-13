#!/usr/bin/env python3
"""Retry transient crawl failures (proxy errors) and capture them."""
import json, os, sys, time
import crawl2

retry=json.load(open('/tmp/retry.json'))
c=crawl2.Crawler(workers=int(os.environ.get('WORKERS','300')))
# remove from seen so they get re-processed; drop from failed
with c.lock:
    for u in retry:
        c.seen.discard(u)
        c.failed.pop(u, None)
print('retrying',len(retry),flush=True)
c.crawl(retry)
