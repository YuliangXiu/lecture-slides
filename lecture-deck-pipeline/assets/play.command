#!/bin/bash
# ============================================================
#  <课程名> · Lecture 1 — play.command（双击运行）
#  在课程根目录 <课程目录> 起本地 http 服务并打开浏览器。
#  讲稿 JSON 必须经 http 加载（file:// 会被浏览器拦截）。
#  停止服务：关闭本终端窗口，或按 Ctrl-C。
# ============================================================
cd "$(dirname "$0")" || { echo "无法定位课程目录"; read -n 1; exit 1; }

# 找一个空闲端口（用 python 探测，不依赖 lsof）
PORT=8321
while /usr/bin/python3 -c "import socket,sys; sys.exit(0 if socket.socket().connect_ex(('127.0.0.1',$PORT))==0 else 1)"; do
  PORT=$((PORT+1))
done

echo "======================================================"
echo "  Lecture 1 放映服务已启动"
echo "  逐字稿对照页:  http://localhost:$PORT/02-script/"
echo "  Session 1:     http://localhost:$PORT/03-slides/session-1/"
echo "  Session 2:     http://localhost:$PORT/03-slides/session-2/"
echo "  Session 3:     http://localhost:$PORT/03-slides/session-3/"
echo "  停止服务: 关闭本终端窗口（或 Ctrl-C）"
echo "======================================================"

( sleep 1.2; open "http://localhost:$PORT/02-script/" ) &
/usr/bin/python3 - "$PORT" <<'PYEOF'
import sys, socket
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

PORT = int(sys.argv[1])

class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass    # 静默常规访问日志（GET / 200 / 404 等），保持终端干净

class QuietServer(ThreadingHTTPServer):
    address_family = socket.AF_INET6          # dual-stack: ::, browser's ::1 and 127.0.0.1 can connect
    daemon_threads = True
    def handle_error(self, request, client_address):
        e = sys.exc_info()[1]
        if isinstance(e, (BrokenPipeError, ConnectionResetError)):
            return    # Browser aborting mid-video-loading is a normal phenomenon (on-demand fetching), silently ignore
        super().handle_error(request, client_address)

print(f"Serving HTTP on port {PORT} ...", flush=True)
QuietServer(("::", PORT), Handler).serve_forever()
PYEOF
RC=$?
if [ $RC -ne 0 ] && [ $RC -ne 130 ]; then    # 130 = Ctrl-C, normal stop
  echo ""
  echo "======================================================"
  echo "  服务异常退出（exit $RC）——请把以上报错截图发给助手。"
  echo "======================================================"
  echo "按任意键关闭…"
  read -n 1
fi
