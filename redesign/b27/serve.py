"""Read-only local review origin. Root opens B2.7 in browser or WKWebView.

No auth, account data or write API. The actual Satoru server is unchanged.
"""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlsplit, unquote

PUBLIC = Path(__file__).resolve().parents[2] / 'public'
class Review(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(PUBLIC), **kwargs)
    def translate_path(self, path):
        route=unquote(urlsplit(path).path)
        if route in ['/', '/index.html', '/app.js', '/app.css', '/preview.html']:
            route='/redesign/'+('index.html' if route=='/' else route.lstrip('/'))
        return super().translate_path(route)
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()
    def list_directory(self,path):
        self.send_error(404)
        return None

if __name__=='__main__':
    print('B2.7: http://127.0.0.1:8772/preview.html',flush=True)
    ThreadingHTTPServer(('127.0.0.1',8772),Review).serve_forever()
