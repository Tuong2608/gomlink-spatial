import json
import os
from datetime import datetime
from http.server import BaseHTTPRequestHandler, HTTPServer

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
INBOX_FILE = os.path.join(BASE_DIR, "inbox_links.md")
ARCHIVE_FILE = os.path.join(BASE_DIR, "da_doc_links.md")
STATE_FILE = os.path.join(BASE_DIR, "sync_state.json")
HOST = "127.0.0.1"
PORT = 18999


def ensure_files():
    if not os.path.exists(INBOX_FILE):
        with open(INBOX_FILE, "w", encoding="utf-8") as f:
            f.write("")
    if not os.path.exists(ARCHIVE_FILE):
        with open(ARCHIVE_FILE, "w", encoding="utf-8") as f:
            f.write(
                "# 📚 Lịch Sử Các Link Đã Đọc & Phân Tích (Archive)\n"
                "> Các link ở đây đã được Antigravity đọc và phân tích xong.\n\n"
            )
    if not os.path.exists(STATE_FILE):
        with open(STATE_FILE, "w", encoding="utf-8") as f:
            json.dump({"clear_token": 0}, f)


def read_text(path):
    ensure_files()
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def write_text(path, content):
    ensure_files()
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)


def get_clear_token():
    ensure_files()
    try:
        with open(STATE_FILE, "r", encoding="utf-8") as f:
            return json.load(f).get("clear_token", 0)
    except Exception:
        return 0


def bump_clear_token():
    token = int(datetime.now().timestamp() * 1000)
    with open(STATE_FILE, "w", encoding="utf-8") as f:
        json.dump({"clear_token": token}, f)
    return token


def count_lines(text):
    return len(
        [
            line.strip()
            for line in (text or "").splitlines()
            if line.strip()
            and not line.strip().startswith("#")
            and not line.strip().startswith(">")
        ]
    )


class BridgeHandler(BaseHTTPRequestHandler):
    def _set_cors(self, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def log_message(self, format, *args):
        pass

    def do_OPTIONS(self):
        self._set_cors(200)

    def do_GET(self):
        if self.path.startswith("/status"):
            inbox = read_text(INBOX_FILE)
            archive = read_text(ARCHIVE_FILE)
            resp = {
                "ok": True,
                "note": inbox,
                "inbox_count": count_lines(inbox),
                "archive_count": count_lines(archive),
                "clear_token": get_clear_token(),
                "inbox_path": INBOX_FILE,
                "archive_path": ARCHIVE_FILE,
            }
            self._set_cors(200)
            self.wfile.write(json.dumps(resp, ensure_ascii=False).encode("utf-8"))
        else:
            self._set_cors(404)
            self.wfile.write(json.dumps({"ok": False, "error": "Not found"}).encode("utf-8"))

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        raw_body = self.rfile.read(length).decode("utf-8") if length > 0 else "{}"
        try:
            data = json.loads(raw_body)
        except Exception:
            data = {}

        if self.path.startswith("/add"):
            url = (data.get("url") or "").strip()
            title = (
                (data.get("title") or "Không tiêu đề")
                .replace("\r", " ")
                .replace("\n", " ")
                .strip()
            )
            force = bool(data.get("force", False))

            inbox = read_text(INBOX_FILE)
            archive = read_text(ARCHIVE_FILE)

            if not url or url.startswith("chrome://") or url.startswith("edge://"):
                status_code = "ignored"
            elif url in inbox:
                status_code = "already_in_inbox"
            elif (not force) and (url in archive):
                status_code = "already_read"
            else:
                new_line = f"- {title} | {url}\n"
                if inbox and not inbox.endswith("\n"):
                    inbox += "\n"
                inbox += new_line
                write_text(INBOX_FILE, inbox)
                status_code = "added"

            resp = {
                "ok": True,
                "status": status_code,
                "note": inbox,
                "inbox_count": count_lines(inbox),
                "archive_count": count_lines(archive),
                "clear_token": get_clear_token(),
            }
            self._set_cors(200)
            self.wfile.write(json.dumps(resp, ensure_ascii=False).encode("utf-8"))

        elif self.path.startswith("/sync"):
            # Đồng bộ 2 chiều giữa chrome.storage.local và inbox_links.md
            local_note = data.get("local_note") or ""
            client_token = data.get("clear_token") or 0
            server_token = get_clear_token()

            inbox = read_text(INBOX_FILE)
            archive = read_text(ARCHIVE_FILE)

            if server_token > client_token:
                # Server vừa được Antigravity mark-read, yêu cầu client xóa local_note
                resp = {
                    "ok": True,
                    "note": inbox,
                    "inbox_count": count_lines(inbox),
                    "archive_count": count_lines(archive),
                    "clear_token": server_token,
                    "cleared": True,
                }
            else:
                # Gộp các dòng mới từ local_note (nếu chưa có trong inbox và chưa có trong archive)
                changed = False
                for line in local_note.splitlines():
                    line_s = line.strip()
                    if not line_s:
                        continue
                    parts = line_s.split("|")
                    url_part = parts[-1].strip() if len(parts) > 1 else line_s
                    if (
                        url_part.startswith("http")
                        and (url_part not in inbox)
                        and (url_part not in archive)
                    ):
                        if inbox and not inbox.endswith("\n"):
                            inbox += "\n"
                        inbox += line_s + "\n"
                        changed = True
                if changed:
                    write_text(INBOX_FILE, inbox)

                resp = {
                    "ok": True,
                    "note": inbox,
                    "inbox_count": count_lines(inbox),
                    "archive_count": count_lines(archive),
                    "clear_token": server_token,
                    "cleared": False,
                }
            self._set_cors(200)
            self.wfile.write(json.dumps(resp, ensure_ascii=False).encode("utf-8"))

        elif self.path.startswith("/update"):
            new_note = data.get("note", "")
            write_text(INBOX_FILE, new_note)
            archive = read_text(ARCHIVE_FILE)
            token = bump_clear_token() if not new_note.strip() else get_clear_token()
            resp = {
                "ok": True,
                "note": new_note,
                "inbox_count": count_lines(new_note),
                "archive_count": count_lines(archive),
                "clear_token": token,
            }
            self._set_cors(200)
            self.wfile.write(json.dumps(resp, ensure_ascii=False).encode("utf-8"))

        elif self.path.startswith("/mark-read"):
            inbox = read_text(INBOX_FILE).strip()
            archive = read_text(ARCHIVE_FILE)
            if inbox:
                now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                if not archive.endswith("\n"):
                    archive += "\n"
                archive += f"\n## Đợt đọc lúc {now_str}\n{inbox}\n"
                write_text(ARCHIVE_FILE, archive)
                write_text(INBOX_FILE, "")
            token = bump_clear_token()
            resp = {
                "ok": True,
                "note": "",
                "inbox_count": 0,
                "archive_count": count_lines(archive),
                "clear_token": token,
            }
            self._set_cors(200)
            self.wfile.write(json.dumps(resp, ensure_ascii=False).encode("utf-8"))

        else:
            self._set_cors(404)
            self.wfile.write(json.dumps({"ok": False, "error": "Not found"}).encode("utf-8"))


if __name__ == "__main__":
    ensure_files()
    server = HTTPServer((HOST, PORT), BridgeHandler)
    server.serve_forever()
