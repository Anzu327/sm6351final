#!/bin/zsh
set -eu
cd -- "${0:A:h}"

if [[ ! -f dist/visitors.html ]]; then
  printf '%s\n' '找不到 dist/visitors.html。请先运行 npm run build。'
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

handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory="dist")
with http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler) as server:
    url = f"http://127.0.0.1:{server.server_port}/visitors.html"
    print(f"VISITORS：{url}\n在这个窗口按 Ctrl+C 关闭服务器。", flush=True)
    webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
PY
