#!/usr/bin/env python3
"""kickoff 화면 모드 서버. 127.0.0.1 에서만 열린다(표준 라이브러리만 사용).

사용: python3 serve.py [--root ~/kickoff] [--port 0]
  실행하면 첫 줄에 주소를 출력하고 <root>/.kickoff-server 에 주소와 pid 를 적는다.

화면이 쓰는 것:
  - <작업>/inbox.json : 카드 답·받은 답에 대한 결정·제출 여부. 에이전트가 읽어 brief.md 에 반영한 뒤 inbox-applied/ 로 옮긴다.
  - <작업>/brief.md   : 단계(0장 상태) 변경만 바로 고치고 9장 변경 기록에 한 줄 남긴다.
"""
import datetime
import importlib.util
import json
import os
import re
import sys
import tempfile
import threading
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

sys.dont_write_bytecode = True  # 스킬 폴더에 __pycache__ 를 만들지 않는다

HERE = Path(__file__).resolve().parent
_spec = importlib.util.spec_from_file_location("board", HERE / "board.py")
board = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(board)
check_brief = board.check_brief

UI = HERE.parent / "assets" / "ui.html"
STAGES = check_brief.KICKOFF_STAGES | check_brief.USER_STAGES
REPLY_DECISIONS = {"반영", "추가 질문", "빼기"}
MAX_BODY = 64 * 1024
LOCK = threading.Lock()  # inbox.json·brief.md 를 읽고 고치고 쓰는 동안 한 요청만


def atomic_write(path, text):
    fd, tmp = tempfile.mkstemp(dir=path.parent, prefix=path.name + ".", suffix=".tmp")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        f.write(text)
    os.replace(tmp, path)


def one_line(text, limit):
    return " ".join(str(text or "").split())[:limit]


def read_json(path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return default


def sections_for_ui(text):
    """brief.md 를 장별 블록(표/글)으로 나눈다."""
    out, cur = [], None
    for line in text.splitlines():
        m = re.match(r"^##\s+(\d+)\.\s*(.*)$", line)
        if m:
            cur = {"no": int(m.group(1)), "title": m.group(2).strip(), "blocks": []}
            out.append(cur)
            continue
        if cur is None:
            continue
        blocks = cur["blocks"]
        if line.strip().startswith("|"):
            if not blocks or blocks[-1]["type"] != "table":
                blocks.append({"type": "table", "lines": []})
            blocks[-1]["lines"].append(line)
        elif line.strip():
            if not blocks or blocks[-1]["type"] != "text":
                blocks.append({"type": "text", "lines": []})
            blocks[-1]["lines"].append(line)
        else:
            blocks.append({"type": "gap"})
    for sec in out:
        kept = []
        for b in sec["blocks"]:
            if b["type"] == "gap":
                continue
            if b["type"] == "table":
                lines = b.pop("lines")
                if len(lines) < 2 or not check_brief.SEPARATOR.match(lines[1].strip()):
                    b.update({"type": "text", "lines": lines})  # 표가 아니면 글로 보여준다
                else:
                    b["header"] = check_brief.split_row(lines[0])
                    b["rows"] = [check_brief.split_row(l) for l in lines[2:]]
            kept.append(b)
        sec["blocks"] = kept
    return out


def set_stage(brief_path, value, note):
    text = brief_path.read_text(encoding="utf-8")
    # splitlines 는 U+2028 같은 글자에서도 줄을 나눠 표 칸을 깨뜨리므로 \n 으로만 나눈다
    lines = [l.rstrip("\r") for l in text.split("\n")]
    if lines and lines[-1] == "":
        lines.pop()
    in0, done = False, False
    for i, line in enumerate(lines):
        if re.match(r"^##\s+0\.", line):
            in0 = True
            continue
        if in0 and line.startswith("## "):
            break
        if in0 and re.match(r"^\|\s*상태\s*\|", line):
            lines[i] = f"| 상태 | {value} |"
            done = True
            break
    if not done:
        raise ValueError("0장 상태 행을 찾지 못했다")
    today = datetime.date.today().isoformat()
    log = f"- {today} 상태 → {value}" + (f" ({note})" if note else "") + " — 화면에서 변경"
    # 9장 끝에 붙인다
    idx9 = next((i for i, l in enumerate(lines) if re.match(r"^##\s+9\.", l)), None)
    if idx9 is None:
        lines += ["", "## 9. 변경 기록", log]
    else:
        end = next((i for i in range(idx9 + 1, len(lines)) if lines[i].startswith("## ")), len(lines))
        while end > idx9 + 1 and not lines[end - 1].strip():
            end -= 1
        lines.insert(end, log)
    atomic_write(brief_path, "\n".join(lines) + "\n")


class Handler(BaseHTTPRequestHandler):
    root = None
    port = None
    timeout = 10  # 본문이 덜 오면 스레드를 붙잡지 않는다

    def log_message(self, fmt, *args):  # 조용히
        pass

    def send_json(self, obj, code=200):
        data = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def task_dir(self, raw):
        try:
            slug = urllib.parse.unquote(raw, errors="strict")
        except UnicodeDecodeError:
            return None
        return board.valid_task_dir(self.root, slug)

    def host_ok(self):
        """DNS rebinding 을 막는다: 127.0.0.1·localhost 로 들어온 요청만 받는다."""
        host = self.headers.get("Host", "")
        if host in {f"127.0.0.1:{self.port}", f"localhost:{self.port}"}:
            return True
        self.send_json({"error": "허용하지 않는 Host"}, 403)
        return False

    def post_ok(self):
        """다른 웹페이지가 보내는 요청(CSRF)을 막는다: JSON 본문과 같은 출처만 받는다."""
        if not (self.headers.get("Content-Type") or "").startswith("application/json"):
            self.send_json({"error": "Content-Type 은 application/json"}, 415)
            return False
        origin = self.headers.get("Origin")
        if origin and origin not in {f"http://127.0.0.1:{self.port}", f"http://localhost:{self.port}"}:
            self.send_json({"error": "허용하지 않는 Origin"}, 403)
            return False
        return True

    def do_GET(self):
        if not self.host_ok():
            return
        path = self.path.split("?", 1)[0]
        if path in {"/", "/index.html"}:
            data = UI.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        if path == "/api/board":
            self.send_json({"root": str(self.root), "columns": board.COLUMNS, "tasks": board.collect(str(self.root))})
            return
        m = re.match(r"^/api/task/([^/]+)$", path)
        if m:
            d = self.task_dir(m.group(1))
            if not d:
                self.send_json({"error": "작업을 찾지 못했다"}, 404)
                return
            try:
                text = (d / "brief.md").read_text(encoding="utf-8")
            except (OSError, UnicodeDecodeError) as e:
                self.send_json({"error": f"brief.md 를 읽지 못했다: {e}"}, 500)
                return
            result = check_brief.check_text(text, str(d / "brief.md"))
            state = board.task_state(d)
            result.update({k: state[k] for k in ("cards_open", "replies_open", "inbox_pending", "inbox_draft", "column")})
            qfile = d / "questions.md"
            self.send_json({
                "slug": d.name,
                "dir": str(d),
                "check": result,
                "sections": sections_for_ui(text),
                "cards": read_json(d / "cards.json", None),
                "inbox": read_json(d / "inbox.json", None),
                "questions_md": qfile.read_text(encoding="utf-8") if qfile.is_file() else None,
                "updated": int((d / "brief.md").stat().st_mtime),
            })
            return
        self.send_json({"error": "없는 주소"}, 404)

    def do_POST(self):
        if not self.host_ok() or not self.post_ok():
            return
        m = re.match(r"^/api/task/([^/]+)/(inbox|stage)$", self.path.split("?", 1)[0])
        if not m:
            self.send_json({"error": "없는 주소"}, 404)
            return
        d = self.task_dir(m.group(1))
        if not d:
            self.send_json({"error": "작업을 찾지 못했다"}, 404)
            return
        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            length = -1
        if length <= 0 or length > MAX_BODY:
            self.send_json({"error": "본문 크기가 맞지 않다"}, 400)
            return
        try:
            body = json.loads(self.rfile.read(length).decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            self.send_json({"error": "JSON 이 아니다"}, 400)
            return
        if not isinstance(body, dict):
            self.send_json({"error": "JSON 객체가 아니다"}, 400)
            return
        with LOCK:
            self.handle_post(d, m.group(2), body)

    def handle_post(self, d, kind_path, body):
        now = datetime.datetime.now().isoformat(timespec="seconds")

        if kind_path == "stage":
            value = str(body.get("value", ""))
            if value not in STAGES:
                self.send_json({"error": f"단계는 {sorted(STAGES)} 중 하나"}, 400)
                return
            try:
                set_stage(d / "brief.md", value, one_line(body.get("note"), 200))
            except ValueError as e:
                self.send_json({"error": str(e)}, 400)
                return
            self.send_json({"ok": True})
            return

        inbox_path = d / "inbox.json"
        inbox = read_json(inbox_path, {})
        if not isinstance(inbox, dict):
            inbox = {}
        for k in ("cards", "replies"):
            if not isinstance(inbox.get(k), dict):
                inbox[k] = {}
        kind = body.get("type")
        if kind == "card":
            cid = str(body.get("id", ""))[:40]
            if not cid:
                self.send_json({"error": "카드 id 가 없다"}, 400)
                return
            inbox["cards"][cid] = {"choice": str(body.get("choice", ""))[:300], "note": str(body.get("note", ""))[:2000], "at": now}
        elif kind == "reply":
            qid = str(body.get("qid", ""))
            if not re.fullmatch(r"Q-\d+", qid) or body.get("decision") not in REPLY_DECISIONS:
                self.send_json({"error": f"qid 는 Q-n, decision 은 {sorted(REPLY_DECISIONS)} 중 하나"}, 400)
                return
            inbox["replies"][qid] = {"decision": body["decision"], "note": str(body.get("note", ""))[:2000], "at": now}
        elif kind == "unset":
            inbox["cards"].pop(str(body.get("id", "")), None)
            inbox["replies"].pop(str(body.get("id", "")), None)
        elif kind == "submit":
            if not inbox["cards"] and not inbox["replies"]:
                self.send_json({"error": "제출할 답이 없다"}, 400)
                return
            inbox["submitted"] = True
            inbox["submitted_at"] = now
        else:
            self.send_json({"error": "type 은 card / reply / unset / submit"}, 400)
            return
        if kind != "submit":
            inbox["submitted"] = False
        atomic_write(inbox_path, json.dumps(inbox, ensure_ascii=False, indent=2))
        self.send_json({"ok": True, "inbox": inbox})


def main():
    argv = sys.argv[1:]
    root = os.path.expanduser(argv[argv.index("--root") + 1]) if "--root" in argv else os.path.expanduser("~/kickoff")
    port = int(argv[argv.index("--port") + 1]) if "--port" in argv else 0
    Path(root).mkdir(parents=True, exist_ok=True)
    Handler.root = Path(root).resolve()
    httpd = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    Handler.port = httpd.server_address[1]
    url = f"http://127.0.0.1:{httpd.server_address[1]}/"
    (Handler.root / ".kickoff-server").write_text(json.dumps({"url": url, "pid": os.getpid()}), encoding="utf-8")
    print(url, flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        try:
            (Handler.root / ".kickoff-server").unlink()
        except OSError:
            pass


if __name__ == "__main__":
    main()
