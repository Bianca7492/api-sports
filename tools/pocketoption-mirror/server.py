#!/usr/bin/env python3
"""Static server for the Pocket Option mirror.

Serves site/m.pocketoption.com at the sandbox URL, resolving directory
indexes and extensionless routes exactly like the origin, with no redirects.
"""
import os, sys, http.server, socketserver, urllib.parse, mimetypes, json

ROOT = os.path.abspath(os.environ.get('SERVE_ROOT', 'site/m.pocketoption.com'))
PORT = int(os.environ.get('PORT', '12000'))

mimetypes.add_type('application/javascript', '.js')
mimetypes.add_type('application/javascript', '.mjs')
mimetypes.add_type('text/css', '.css')
mimetypes.add_type('image/webp', '.webp')
mimetypes.add_type('image/avif', '.avif')
mimetypes.add_type('font/woff2', '.woff2')
mimetypes.add_type('application/json', '.json')
mimetypes.add_type('image/svg+xml', '.svg')


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def log_message(self, fmt, *args):
        pass

    def translate_path(self, path):
        path = urllib.parse.unquote(urllib.parse.urlsplit(path).path)
        parts = [p for p in path.split('/') if p and p not in ('.', '..')]
        cand = os.path.join(ROOT, *parts)
        for c in (cand, cand + '.html', os.path.join(cand, 'index.html')):
            if os.path.isfile(c):
                return c
        # directory: pick index.html
        if os.path.isdir(cand) and os.path.isfile(os.path.join(cand, 'index.html')):
            return os.path.join(cand, 'index.html')
        # Dynamic routes (per-user ?uid=, social-login, ajax variants) were not
        # mirrored. Serve the closest existing ancestor page so links resolve.
        for k in range(len(parts) - 1, 0, -1):
            anc = os.path.join(ROOT, *parts[:k], 'index.html')
            if os.path.isfile(anc):
                return anc
        return cand

    def send_head(self):
        p = self.translate_path(self.path)
        if os.path.isdir(p):
            idx = os.path.join(p, 'index.html')
            if os.path.isfile(idx):
                p = idx
        if not os.path.isfile(p):
            self.send_error(404, 'Not Found', 'Mirror has no such route: ' + self.path)
            return None
        try:
            f = open(p, 'rb')
        except OSError:
            self.send_error(404, 'Not Found')
            return None
        fs = os.fstat(f.fileno())
        self.send_response(200)
        ctype = self.guess_type(p)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(fs.st_size))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        return f


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


if __name__ == '__main__':
    os.chdir(ROOT)
    with Server(('0.0.0.0', PORT), Handler) as httpd:
        print('serving %s at http://0.0.0.0:%d' % (ROOT, PORT), flush=True)
        httpd.serve_forever()
