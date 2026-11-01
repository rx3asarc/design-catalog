# r10-perf measurement fixture — the r9 before-run's server (/tmp/r9-home-serve/serve.py:
# gzip text + no-store), pointed at the CURRENT build tree on 8831 so the after-run is on the
# same wire encoding as the before-run. Read-only over /tmp/serve/design-catalog.
import http.server, socketserver, functools, os, gzip, shutil

DIR = "/tmp/serve"
PORT = 8831

class Gz(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()
    def copyfile(self, source, output):
        if getattr(self, "_gz", False):
            with gzip.GzipFile(fileobj=output, mode="wb", compresslevel=6, mtime=0) as g:
                shutil.copyfileobj(source, g)
        else:
            super().copyfile(source, output)
    def send_head(self):
        path = self.translate_path(self.path)
        if os.path.isdir(path) or not os.path.isfile(path):
            return super().send_head()
        ctype = self.guess_type(path)
        gz = any(path.endswith(e) for e in (".js", ".css", ".html", ".json", ".mjs", ".svg"))
        f = open(path, "rb")
        fs = os.fstat(f.fileno())
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        if gz:
            self.send_header("Content-Encoding", "gzip")
            self.send_header("Vary", "Accept-Encoding")
        else:
            self.send_header("Content-Length", str(fs[6]))
        self.send_header("Last-Modified", self.date_time_string(fs.st_mtime))
        self._gz = gz
        self.end_headers()
        return f

h = functools.partial(Gz, directory=DIR)
class S(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True
S(("127.0.0.1", PORT), h).serve_forever()
