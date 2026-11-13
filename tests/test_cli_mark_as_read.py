"""
Tests for mark_as_read.py CLI utility.
"""

from __future__ import annotations

import os
import sys
import tempfile
import threading
import time
from typing import Generator, Tuple

import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from bridge_server import GomLinkStorage, create_server
from mark_as_read import mark_links_as_read


@pytest.fixture
def running_server() -> Generator[Tuple[str, int, GomLinkStorage], None, None]:
    """Launch a temporary bridge server for CLI testing."""
    with tempfile.TemporaryDirectory() as tmp_dir:
        storage = GomLinkStorage(base_dir=tmp_dir)
        server = create_server(host="127.0.0.1", port=0, storage=storage)
        host, port = server.server_address

        server_thread = threading.Thread(target=server.serve_forever, daemon=True)
        server_thread.start()

        time.sleep(0.05)
        yield host, port, storage

        server.shutdown()
        server.server_close()


class TestCliMarkAsRead:
    def test_mark_links_as_read_success(
        self, running_server: Tuple[str, int, GomLinkStorage]
    ) -> None:
        """Calling mark_links_as_read with running server should archive links."""
        host, port, storage = running_server
        storage.write_text(storage.inbox_file, "- Item | https://test.org\n")

        result = mark_links_as_read(host=host, port=port, timeout=3.0, quiet=True)
        assert result is not None
        assert result.get("ok") is True
        assert result.get("inbox_count") == 0
        assert result.get("archive_count") == 1
        assert storage.read_text(storage.inbox_file) == ""

    def test_mark_links_as_read_server_offline_returns_none(self) -> None:
        """Calling mark_links_as_read on an inactive port should gracefully return None."""
        # Port 65432 is arbitrary and unlikely to be bound
        result = mark_links_as_read(host="127.0.0.1", port=65432, timeout=0.5, quiet=True)
        assert result is None
