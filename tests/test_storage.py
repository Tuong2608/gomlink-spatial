"""
Unit tests for GomLinkStorage class in bridge_server.py.
"""

from __future__ import annotations

import json
import os
import sys
import tempfile
from typing import Generator

import pytest

# Add parent directory to path so bridge_server can be imported
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from bridge_server import GomLinkStorage


@pytest.fixture
def temp_storage() -> Generator[GomLinkStorage, None, None]:
    """Provide an isolated GomLinkStorage instance in a temporary folder."""
    with tempfile.TemporaryDirectory() as tmp_dir:
        storage = GomLinkStorage(base_dir=tmp_dir)
        yield storage


class TestGomLinkStorage:
    def test_initialization_creates_default_files(self, temp_storage: GomLinkStorage) -> None:
        """Storage should initialize inbox, archive, and sync state files on start."""
        assert os.path.exists(temp_storage.inbox_file)
        assert os.path.exists(temp_storage.archive_file)
        assert os.path.exists(temp_storage.state_file)

        assert temp_storage.read_text(temp_storage.inbox_file) == ""
        assert "Lịch Sử Các Link Đã Đọc" in temp_storage.read_text(temp_storage.archive_file)
        assert temp_storage.get_clear_token() == 0

    def test_read_and_write_text(self, temp_storage: GomLinkStorage) -> None:
        """Reading and writing text should be persistent and UTF-8 safe."""
        custom_file = os.path.join(temp_storage.base_dir, "custom.txt")
        test_content = "Tiếng Việt có dấu: Cà phê sữa đá & Trà ô long ☕\n"
        success = temp_storage.write_text(custom_file, test_content)
        assert success is True
        assert temp_storage.read_text(custom_file) == test_content

    def test_count_lines_ignores_headers_and_quotes(self) -> None:
        """count_lines should only count actual link lines, ignoring headers and blockquotes."""
        raw_markdown = (
            "# Heading 1\n"
            "> Blockquote explanation\n"
            "\n"
            "- Item 1 | https://example.com/1\n"
            "   \n"
            "- Item 2 | https://example.com/2\n"
            "## Subheading\n"
            "> Another quote\n"
            "- Item 3 | https://example.com/3\n"
        )
        count = GomLinkStorage.count_lines(raw_markdown)
        assert count == 3

    def test_count_lines_with_empty_or_none(self) -> None:
        """count_lines should safely handle empty strings or None."""
        assert GomLinkStorage.count_lines("") == 0
        assert GomLinkStorage.count_lines(None) == 0
        assert GomLinkStorage.count_lines("   \n\n  \t ") == 0

    def test_clean_title(self) -> None:
        """clean_title should strip newlines and excessive whitespace."""
        assert GomLinkStorage.clean_title(None) == "Không tiêu đề"
        assert GomLinkStorage.clean_title("") == "Không tiêu đề"
        assert GomLinkStorage.clean_title("   ") == "Không tiêu đề"
        assert (
            GomLinkStorage.clean_title("Tiêu đề\r\nvới\n nhiều dòng   và cách")
            == "Tiêu đề với nhiều dòng và cách"
        )

    def test_format_link_line(self) -> None:
        """format_link_line should produce standard Markdown link line."""
        line = GomLinkStorage.format_link_line("Google Search", "https://google.com")
        assert line == "- Google Search | https://google.com\n"

    def test_get_and_bump_clear_token(self, temp_storage: GomLinkStorage) -> None:
        """bump_clear_token should produce a strictly increasing timestamp token."""
        token_1 = temp_storage.get_clear_token()
        assert token_1 == 0

        token_2 = temp_storage.bump_clear_token()
        assert token_2 > 0
        assert temp_storage.get_clear_token() == token_2

    def test_get_clear_token_recovers_from_corrupted_json(
        self, temp_storage: GomLinkStorage
    ) -> None:
        """If sync_state.json is corrupted with invalid JSON, it should auto-heal to token 0."""
        with open(temp_storage.state_file, "w", encoding="utf-8") as f:
            f.write("{ invalid json corrupted bytes ...")

        token = temp_storage.get_clear_token()
        assert token == 0

        # Verify that state file was automatically rewritten with valid JSON
        with open(temp_storage.state_file, "r", encoding="utf-8") as f:
            data = json.load(f)
            assert data.get("clear_token") == 0

    def test_get_status_payload(self, temp_storage: GomLinkStorage) -> None:
        """get_status_payload should return complete status metadata."""
        temp_storage.write_text(
            temp_storage.inbox_file,
            "- Link 1 | https://a.com\n- Link 2 | https://b.com\n",
        )
        status = temp_storage.get_status_payload()
        assert status["ok"] is True
        assert status["inbox_count"] == 2
        assert status["clear_token"] == 0
        assert status["inbox_path"] == temp_storage.inbox_file
        assert status["archive_path"] == temp_storage.archive_file
