"""
GomLink Spatial - Mark-as-read CLI Utility
Triggered by AI Agents or developers to flush inbox_links.md into da_doc_links.md (Archive)
and bump the synchronization token.
"""

from __future__ import annotations

import argparse
import json
import sys

sys.dont_write_bytecode = True
import urllib.error
import urllib.request
from typing import Any, Dict, Optional


def mark_links_as_read(
    host: str = "127.0.0.1",
    port: int = 18999,
    timeout: float = 5.0,
    quiet: bool = False,
) -> Optional[Dict[str, Any]]:
    """Send POST /mark-read request to local bridge server."""
    url = f"http://{host}:{port}/mark-read"
    req = urllib.request.Request(
        url,
        data=b"{}",
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw_body = resp.read().decode("utf-8")
            data: Dict[str, Any] = json.loads(raw_body)

        if not quiet:
            archive_cnt = data.get("archive_count", 0)
            inbox_cnt = data.get("inbox_count", 0)
            print(
                f"✅ Đã chuyển toàn bộ link sang da_doc_links.md! "
                f"Tổng số link đã đọc: {archive_cnt}, Inbox hiện tại: {inbox_cnt}"
            )
        return data

    except urllib.error.URLError as e:
        if not quiet:
            sys.stderr.write(
                f"❌ Lỗi kết nối Bridge Server tại {url}: {e.reason}\n"
                f"💡 Hãy đảm bảo 'start_bridge.bat' hoặc 'bridge_server.py' đang chạy.\n"
            )
        return None
    except Exception as e:
        if not quiet:
            sys.stderr.write(f"❌ Lỗi không xác định khi gọi /mark-read: {e}\n")
        return None


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

    parser = argparse.ArgumentParser(
        description="GomLink CLI: Đánh dấu tất cả link trong inbox là đã đọc và lưu vào Archive."
    )
    parser.add_argument(
        "--host",
        default="127.0.0.1",
        help="Host của Bridge Server (mặc định: 127.0.0.1)",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=18999,
        help="Port của Bridge Server (mặc định: 18999)",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=5.0,
        help="Thời gian chờ tối đa (giây)",
    )
    parser.add_argument(
        "--quiet",
        action="store_true",
        help="Chạy ở chế độ im lặng, không in output ra màn hình",
    )

    args = parser.parse_args()
    result = mark_links_as_read(
        host=args.host,
        port=args.port,
        timeout=args.timeout,
        quiet=args.quiet,
    )
    return 0 if result is not None and result.get("ok", False) else 1


if __name__ == "__main__":
    sys.exit(main())
