"""
GomLink Spatial - Local AI Agent Bridge Server
Provides a high-performance, robust HTTP bridge between Chrome Extension and local files:
- inbox_links.md (live incoming queue for AI Agents)
- da_doc_links.md (archived processed links)
- sync_state.json (sync token tracker)
"""

from __future__ import annotations

import json
import logging
import os
import sys

sys.dont_write_bytecode = True
from datetime import datetime
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger("GomLinkBridge")
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)

DEFAULT_BASE_DIR: str = os.path.dirname(os.path.abspath(__file__))
DEFAULT_HOST: str = "127.0.0.1"
DEFAULT_PORT: int = 18999


class GomLinkStorage:
    """Encapsulates persistent file access, thread safety, and auto-recovery."""

    def __init__(self, base_dir: Optional[str] = None) -> None:
        self.base_dir: str = base_dir or DEFAULT_BASE_DIR
        self.inbox_file: str = os.path.join(self.base_dir, "inbox_links.md")
        self.archive_file: str = os.path.join(self.base_dir, "da_doc_links.md")
        self.state_file: str = os.path.join(self.base_dir, "sync_state.json")
        self.ensure_files()

    def ensure_files(self) -> None:
        """Create initial files if missing."""
        os.makedirs(self.base_dir, exist_ok=True)
        if not os.path.exists(self.inbox_file):
            with open(self.inbox_file, "w", encoding="utf-8") as f:
                f.write("")
        if not os.path.exists(self.archive_file):
            with open(self.archive_file, "w", encoding="utf-8") as f:
                f.write(
                    "# 📚 Lịch Sử Các Link Đã Đọc & Phân Tích (Archive)\n"
                    "> Các link ở đây đã được Antigravity đọc và phân tích xong.\n\n"
                )
        if not os.path.exists(self.state_file):
            self._write_state({"clear_token": 0})

    def _write_state(self, state: Dict[str, Any]) -> None:
        with open(self.state_file, "w", encoding="utf-8") as f:
            json.dump(state, f, indent=2)

    def read_text(self, path: str) -> str:
        """Read full text content safely with automatic creation on error."""
        try:
            with open(path, "r", encoding="utf-8") as f:
                return f.read()
        except FileNotFoundError:
            self.ensure_files()
            with open(path, "r", encoding="utf-8") as f:
                return f.read()
        except Exception as e:
            logger.error("Failed to read %s: %s", path, e)
            return ""

    def write_text(self, path: str, content: str) -> bool:
        """Write text content to file safely."""
        try:
            with open(path, "w", encoding="utf-8") as f:
                f.write(content)
            return True
        except Exception as e:
            logger.error("Failed to write to %s: %s", path, e)
            return False

    def get_clear_token(self) -> int:
        """Get the current clear token with auto-healing for corrupted state files."""
        try:
            with open(self.state_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, dict):
                    token = data.get("clear_token", 0)
                    return int(token)
        except (json.JSONDecodeError, ValueError, FileNotFoundError, TypeError):
            logger.warning("Corrupted or missing sync state. Resetting state file.")
            self._write_state({"clear_token": 0})
        except Exception as e:
            logger.error("Unexpected error reading clear token: %s", e)
        return 0

    def bump_clear_token(self) -> int:
        """Update and return a new timestamp-based clear token."""
        token = int(datetime.now().timestamp() * 1000)
        self._write_state({"clear_token": token})
        return token

    @staticmethod
    def count_lines(text: Optional[str]) -> int:
        """Count valid non-header, non-quote content lines."""
        if not text:
            return 0
        return len(
            [
                line.strip()
                for line in text.splitlines()
                if line.strip()
                and not line.strip().startswith("#")
                and not line.strip().startswith(">")
            ]
        )

    @staticmethod
    def clean_title(title: Optional[str]) -> str:
        """Sanitize title by removing carriage returns and excessive whitespace."""
        if not title:
            return "Không tiêu đề"
        cleaned = " ".join(title.replace("\r", " ").replace("\n", " ").split())
        return cleaned or "Không tiêu đề"

    @staticmethod
    def format_link_line(title: str, url: str) -> str:
        """Format link entry as Markdown item."""
        clean_title = GomLinkStorage.clean_title(title)
        return f"- {clean_title} | {url.strip()}\n"

    def get_status_payload(self) -> Dict[str, Any]:
        """Build standard status snapshot."""
        inbox = self.read_text(self.inbox_file)
        archive = self.read_text(self.archive_file)
        return {
            "ok": True,
            "note": inbox,
            "inbox_count": self.count_lines(inbox),
            "archive_count": self.count_lines(archive),
            "clear_token": self.get_clear_token(),
            "inbox_path": self.inbox_file,
            "archive_path": self.archive_file,
        }


class BridgeHandler(BaseHTTPRequestHandler):
    """HTTP request handler supporting CORS, JSON payloads, and storage interactions."""

    storage: GomLinkStorage = GomLinkStorage()

    def log_message(self, format: str, *args: Any) -> None:
        """Disable default noisy console logging."""
        pass

    def _send_json(self, status: int, payload: Dict[str, Any]) -> None:
        """Unified helper to send standard JSON responses with CORS headers."""
        try:
            body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def do_OPTIONS(self) -> None:
        """Handle CORS pre-flight requests."""
        self._send_json(200, {"ok": True})

    def do_GET(self) -> None:
        """Handle GET requests (/status)."""
        if self.path.startswith("/status"):
            self._send_json(200, self.storage.get_status_payload())
        else:
            self._send_json(404, {"ok": False, "error": f"Endpoint not found: {self.path}"})

    def _read_json_body(self) -> Tuple[bool, Dict[str, Any], Optional[str]]:
        """Safely parse incoming JSON body with strict type and error checking."""
        try:
            content_length_header = self.headers.get("Content-Length")
            if not content_length_header:
                return True, {}, None
            length = int(content_length_header)
            if length < 0:
                return False, {}, "Invalid negative Content-Length"
            raw_body = self.rfile.read(length).decode("utf-8") if length > 0 else "{}"
            data = json.loads(raw_body)
            if not isinstance(data, dict):
                return False, {}, "Body must be a JSON object"
            return True, data, None
        except json.JSONDecodeError as e:
            return False, {}, f"Invalid JSON payload: {e}"
        except ValueError as e:
            return False, {}, f"Invalid Content-Length header or encoding: {e}"
        except Exception as e:
            return False, {}, f"Unexpected body read error: {e}"

    def do_POST(self) -> None:
        """Handle POST actions (/add, /sync, /update, /mark-read)."""
        ok, data, error_msg = self._read_json_body()
        if not ok:
            self._send_json(400, {"ok": False, "error": error_msg})
            return

        if self.path.startswith("/add"):
            self._handle_add(data)
        elif self.path.startswith("/sync"):
            self._handle_sync(data)
        elif self.path.startswith("/update"):
            self._handle_update(data)
        elif self.path.startswith("/mark-read"):
            self._handle_mark_read()
        else:
            self._send_json(404, {"ok": False, "error": f"Endpoint not found: {self.path}"})

    def _handle_add(self, data: Dict[str, Any]) -> None:
        url = str(data.get("url") or "").strip()
        title = self.storage.clean_title(str(data.get("title") or ""))
        force = bool(data.get("force", False))

        inbox = self.storage.read_text(self.storage.inbox_file)
        archive = self.storage.read_text(self.storage.archive_file)

        if (
            not url
            or url.startswith("chrome://")
            or url.startswith("edge://")
            or url.startswith("about:")
        ):
            status_code = "ignored"
        elif url in inbox:
            status_code = "already_in_inbox"
        elif (not force) and (url in archive):
            status_code = "already_read"
        else:
            new_line = self.storage.format_link_line(title, url)
            if inbox and not inbox.endswith("\n"):
                inbox += "\n"
            inbox += new_line
            self.storage.write_text(self.storage.inbox_file, inbox)
            status_code = "added"

        resp = {
            "ok": True,
            "status": status_code,
            "note": inbox,
            "inbox_count": self.storage.count_lines(inbox),
            "archive_count": self.storage.count_lines(archive),
            "clear_token": self.storage.get_clear_token(),
        }
        self._send_json(200, resp)

    def _handle_sync(self, data: Dict[str, Any]) -> None:
        local_note = str(data.get("local_note") or "")
        try:
            client_token = int(data.get("clear_token") or 0)
        except (ValueError, TypeError):
            client_token = 0

        server_token = self.storage.get_clear_token()
        inbox = self.storage.read_text(self.storage.inbox_file)
        archive = self.storage.read_text(self.storage.archive_file)

        if server_token > client_token:
            # Server was marked-read by an agent; signal client to flush local storage
            resp = {
                "ok": True,
                "note": inbox,
                "inbox_count": self.storage.count_lines(inbox),
                "archive_count": self.storage.count_lines(archive),
                "clear_token": server_token,
                "cleared": True,
            }
        else:
            # Bidirectional merge of unseen lines
            changed = False
            for line in local_note.splitlines():
                line_s = line.strip()
                if not line_s or line_s.startswith("#") or line_s.startswith(">"):
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
                self.storage.write_text(self.storage.inbox_file, inbox)

            resp = {
                "ok": True,
                "note": inbox,
                "inbox_count": self.storage.count_lines(inbox),
                "archive_count": self.storage.count_lines(archive),
                "clear_token": server_token,
                "cleared": False,
            }
        self._send_json(200, resp)

    def _handle_update(self, data: Dict[str, Any]) -> None:
        new_note = str(data.get("note") or "")
        self.storage.write_text(self.storage.inbox_file, new_note)
        archive = self.storage.read_text(self.storage.archive_file)
        token = (
            self.storage.bump_clear_token()
            if not new_note.strip()
            else self.storage.get_clear_token()
        )
        resp = {
            "ok": True,
            "note": new_note,
            "inbox_count": self.storage.count_lines(new_note),
            "archive_count": self.storage.count_lines(archive),
            "clear_token": token,
        }
        self._send_json(200, resp)

    def _handle_mark_read(self) -> None:
        inbox = self.storage.read_text(self.storage.inbox_file).strip()
        archive = self.storage.read_text(self.storage.archive_file)
        if inbox:
            now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            if not archive.endswith("\n"):
                archive += "\n"
            archive += f"\n## Đợt đọc lúc {now_str}\n{inbox}\n"
            self.storage.write_text(self.storage.archive_file, archive)
            self.storage.write_text(self.storage.inbox_file, "")
        token = self.storage.bump_clear_token()
        resp = {
            "ok": True,
            "note": "",
            "inbox_count": 0,
            "archive_count": self.storage.count_lines(archive),
            "clear_token": token,
        }
        self._send_json(200, resp)


def create_server(
    host: str = DEFAULT_HOST,
    port: int = DEFAULT_PORT,
    storage: Optional[GomLinkStorage] = None,
) -> HTTPServer:
    """Create configured HTTPServer instance with socket reuse enabled."""
    storage_instance = storage or GomLinkStorage()

    class CustomHandler(BridgeHandler):
        storage = storage_instance

    HTTPServer.allow_reuse_address = True
    server = HTTPServer((host, port), CustomHandler)
    return server


def main() -> None:
    """Entry point for running the server CLI."""
    host = os.environ.get("GOMLINK_HOST", DEFAULT_HOST)
    port = int(os.environ.get("GOMLINK_PORT", str(DEFAULT_PORT)))
    storage = GomLinkStorage()
    server = create_server(host=host, port=port, storage=storage)
    logger.info("GomLink Bridge Server running at http://%s:%d", host, port)
    logger.info("Inbox file: %s", storage.inbox_file)
    logger.info("Archive file: %s", storage.archive_file)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        logger.info("Shutting down GomLink Bridge gracefully...")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
