#!/bin/zsh
set -eu
cd -- "${0:A:h}"

if [[ ! -f dist/sleep-well/index.html || ! -f dist/visitors.html ]]; then
  printf '%s\n' '找不到整合版的构建文件。请先运行 npm run build。'
  exit 1
fi
if ! command -v python3 >/dev/null; then
  printf '%s\n' '请安装 Python 3，或使用 npm run preview 启动。'
  exit 1
fi

exec python3 - <<'PY'
import functools
import http.server
import webbrowser

class PreviewServer(http.server.ThreadingHTTPServer):
    # The opening page requests multiple media and WebGL assets at once.
    request_queue_size = 64

handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory="dist")
with PreviewServer(("127.0.0.1", 0), handler) as server:
    url = f"http://127.0.0.1:{server.server_port}/sleep-well/index.html"
    print(f"VISITORS · Chelyabinsk：{url}\n在这个窗口按 Ctrl+C 关闭服务器。", flush=True)
    webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
PY
