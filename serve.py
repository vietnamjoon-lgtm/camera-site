# 로컬 서버: python3 -m http.server와 같지만, 브라우저가 예전 파일을 저장해 두지 않게 해서
# 코드를 고치면 새로고침만으로 바로 바뀐다.
import http.server
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
http.server.ThreadingHTTPServer(("", port), NoCacheHandler).serve_forever()
