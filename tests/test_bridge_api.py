"""
Integration tests for GomLink Bridge Server HTTP endpoints.
Uses a live local HTTP server running on an ephemeral port.
"""

from __future__ import annotations

import json
import os
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.request
from typing import Any, Dict, Generator, Tuple

import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from bridge_server import GomLinkStorage, create_server


@pytest.fixture
def test_server() -> Generator[Tuple[str, int, GomLinkStorage], None, None]:
    """Launch an ephemeral Bridge Server in a background thread with isolated storage."""
    with tempfile.TemporaryDirectory() as tmp_dir:
        storage = GomLinkStorage(base_dir=tmp_dir)
        # Port 0 lets OS allocate an available port automatically
        server = create_server(host="127.0.0.1", port=0, storage=storage)
        host, port = server.server_address

        server_thread = threading.Thread(target=server.serve_forever, daemon=True)
        server_thread.start()

        time.sleep(0.05)  # Allow server to bind and start listening
        yield host, port, storage

        server.shutdown()
        server.server_close()


def make_request(
    host: str,
    port: int,
    path: str,
    method: str = "GET",
    data: Any = None,
    headers: Dict[str, str] = None,
) -> Tuple[int, Dict[str, Any], Dict[str, str]]:
    """Helper to perform HTTP requests against the test server."""
    url = f"http://{host}:{port}{path}"
    req_headers = {"Content-Type": "application/json"}
    if headers:
        req_headers.update(headers)

    body_bytes = None
    if data is not None:
        if isinstance(data, (dict, list)):
            body_bytes = json.dumps(data).encode("utf-8")
        elif isinstance(data, (bytes, bytearray)):
            body_bytes = bytes(data)
        elif isinstance(data, str):
            body_bytes = data.encode("utf-8")

    req = urllib.request.Request(
        url,
        data=body_bytes,
        headers=req_headers,
        method=method,
    )

    try:
        with urllib.request.urlopen(req) as resp:
            status = resp.status
            resp_headers = dict(resp.headers)
            body = resp.read().decode("utf-8")
            try:
                parsed_json = json.loads(body)
            except Exception:
                parsed_json = {"raw": body}
            return status, parsed_json, resp_headers
    except urllib.error.HTTPError as e:
        status = e.code
        resp_headers = dict(e.headers)
        body = e.read().decode("utf-8")
        try:
            parsed_json = json.loads(body)
        except Exception:
            parsed_json = {"raw": body}
        return status, parsed_json, resp_headers


class TestBridgeAPI:
    def test_cors_options(self, test_server: Tuple[str, int, GomLinkStorage]) -> None:
        """OPTIONS preflight should return 200 with appropriate CORS headers."""
        host, port, _ = test_server
        status, body, headers = make_request(host, port, "/status", method="OPTIONS")
        assert status == 200
        assert body["ok"] is True
        assert headers.get("Access-Control-Allow-Origin") == "*"
        assert "POST" in headers.get("Access-Control-Allow-Methods", "")

    def test_get_status(self, test_server: Tuple[str, int, GomLinkStorage]) -> None:
        """GET /status should return inbox count and archive count."""
        host, port, storage = test_server
        status, body, _ = make_request(host, port, "/status")
        assert status == 200
        assert body["ok"] is True
        assert body["inbox_count"] == 0
        assert body["archive_count"] == 0

    def test_post_add_normal_link(self, test_server: Tuple[str, int, GomLinkStorage]) -> None:
        """POST /add should add link to inbox_links.md."""
        host, port, storage = test_server
        payload = {"title": "Google DeepMind", "url": "https://deepmind.google"}
        status, body, _ = make_request(host, port, "/add", method="POST", data=payload)
        assert status == 200
        assert body["ok"] is True
        assert body["status"] == "added"
        assert body["inbox_count"] == 1
        assert "Google DeepMind | https://deepmind.google" in storage.read_text(storage.inbox_file)

    def test_post_add_duplicate_inbox(self, test_server: Tuple[str, int, GomLinkStorage]) -> None:
        """POST /add with URL already in inbox should return 'already_in_inbox'."""
        host, port, _ = test_server
        payload = {"title": "GitHub", "url": "https://github.com"}
        make_request(host, port, "/add", method="POST", data=payload)

        status, body, _ = make_request(host, port, "/add", method="POST", data=payload)
        assert status == 200
        assert body["status"] == "already_in_inbox"
        assert body["inbox_count"] == 1

    def test_post_add_duplicate_archive_without_force(
        self, test_server: Tuple[str, int, GomLinkStorage]
    ) -> None:
        """POST /add with URL in archive should return 'already_read' unless force=True."""
        host, port, storage = test_server
        # Put URL in archive
        storage.write_text(storage.archive_file, "- Old Paper | https://arxiv.org/abs/1234.5678\n")

        # Attempt add without force
        payload = {"title": "Old Paper", "url": "https://arxiv.org/abs/1234.5678"}
        status, body, _ = make_request(host, port, "/add", method="POST", data=payload)
        assert status == 200
        assert body["status"] == "already_read"

        # Attempt add WITH force
        payload["force"] = True
        status, body, _ = make_request(host, port, "/add", method="POST", data=payload)
        assert status == 200
        assert body["status"] == "added"
        assert body["inbox_count"] == 1

    def test_post_add_system_urls_ignored(
        self, test_server: Tuple[str, int, GomLinkStorage]
    ) -> None:
        """POST /add with internal system URLs should be ignored."""
        host, port, _ = test_server
        for bad_url in ["chrome://settings", "edge://extensions", "about:blank", ""]:
            payload = {"title": "System", "url": bad_url}
            status, body, _ = make_request(host, port, "/add", method="POST", data=payload)
            assert status == 200
            assert body["status"] == "ignored"

    def test_post_sync_when_server_newer_clears_client(
        self, test_server: Tuple[str, int, GomLinkStorage]
    ) -> None:
        """If server_token > client_token, /sync should tell client that storage was cleared."""
        host, port, storage = test_server
        storage.bump_clear_token()
        server_token = storage.get_clear_token()

        payload = {"local_note": "- Unsaved | https://unsaved.com\n", "clear_token": 0}
        status, body, _ = make_request(host, port, "/sync", method="POST", data=payload)
        assert status == 200
        assert body["cleared"] is True
        assert body["clear_token"] == server_token

    def test_post_sync_merges_unseen_links(
        self, test_server: Tuple[str, int, GomLinkStorage]
    ) -> None:
        """If client and server tokens are synchronized, /sync should merge unseen local links."""
        host, port, storage = test_server
        token = storage.get_clear_token()

        payload = {
            "local_note": "- Site A | https://a.com\n- Site B | https://b.com\n",
            "clear_token": token,
        }
        status, body, _ = make_request(host, port, "/sync", method="POST", data=payload)
        assert status == 200
        assert body["cleared"] is False
        assert body["inbox_count"] == 2
        assert "https://a.com" in storage.read_text(storage.inbox_file)
        assert "https://b.com" in storage.read_text(storage.inbox_file)

    def test_post_sync_handles_invalid_clear_token_types(
        self, test_server: Tuple[str, int, GomLinkStorage]
    ) -> None:
        """Passing non-integer clear_token (e.g. string or null) should not crash server."""
        host, port, _ = test_server
        payload = {"local_note": "", "clear_token": "invalid_string"}
        status, body, _ = make_request(host, port, "/sync", method="POST", data=payload)
        assert status == 200
        assert body["ok"] is True

    def test_post_update_content(self, test_server: Tuple[str, int, GomLinkStorage]
    ) -> None:
        """POST /update should overwrite inbox content and bump clear_token if emptied."""
        host, port, storage = test_server
        initial_token = storage.get_clear_token()

        # Update with content
        new_text = "- Updated 1 | https://u1.com\n"
        status, body, _ = make_request(
            host, port, "/update", method="POST", data={"note": new_text}
        )
        assert status == 200
        assert body["inbox_count"] == 1
        assert storage.read_text(storage.inbox_file) == new_text

        # Update with empty text -> should trigger bump_clear_token
        status, body, _ = make_request(host, port, "/update", method="POST", data={"note": ""})
        assert status == 200
        assert body["inbox_count"] == 0
        assert body["clear_token"] > initial_token

    def test_post_mark_read_moves_inbox_to_archive(
        self, test_server: Tuple[str, int, GomLinkStorage]
    ) -> None:
        """POST /mark-read should move inbox content to archive with timestamp and clear inbox."""
        host, port, storage = test_server
        storage.write_text(
            storage.inbox_file,
            "- Read Me | https://readme.com\n- Another | https://another.com\n",
        )

        status, body, _ = make_request(host, port, "/mark-read", method="POST", data={})
        assert status == 200
        assert body["ok"] is True
        assert body["inbox_count"] == 0
        assert body["archive_count"] == 2
        assert storage.read_text(storage.inbox_file) == ""
        assert "Đợt đọc lúc" in storage.read_text(storage.archive_file)
        assert "https://readme.com" in storage.read_text(storage.archive_file)

    def test_error_handling_404_not_found(
        self, test_server: Tuple[str, int, GomLinkStorage]
    ) -> None:
        """Unknown endpoints should return 404."""
        host, port, _ = test_server
        status, body, _ = make_request(host, port, "/unknown-endpoint")
        assert status == 404
        assert body["ok"] is False

    def test_error_handling_invalid_json(
        self, test_server: Tuple[str, int, GomLinkStorage]
    ) -> None:
        """Sending malformed JSON syntax should return 400 Bad Request."""
        host, port, _ = test_server
        bad_json = b"{ malformed_json_unclosed: "
        status, body, _ = make_request(
            host,
            port,
            "/add",
            method="POST",
            data=bad_json,
            headers={"Content-Length": str(len(bad_json))},
        )
        assert status == 400
        assert body["ok"] is False
        assert "Invalid JSON payload" in body["error"]

    def test_error_handling_json_not_an_object(
        self, test_server: Tuple[str, int, GomLinkStorage]
    ) -> None:
        """Sending a JSON array instead of an object should return 400 Bad Request."""
        host, port, _ = test_server
        json_array = [1, 2, 3]
        status, body, _ = make_request(host, port, "/add", method="POST", data=json_array)
        assert status == 400
        assert body["ok"] is False
        assert "Body must be a JSON object" in body["error"]
