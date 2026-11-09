import sys
import urllib.request
import json

sys.stdout.reconfigure(encoding="utf-8")

req = urllib.request.Request(
    "http://127.0.0.1:18999/mark-read",
    data=b"{}",
    headers={"Content-Type": "application/json"},
    method="POST",
)
with urllib.request.urlopen(req) as resp:
    result = json.loads(resp.read().decode("utf-8"))
    print(
        f"Đã chuyển toàn bộ link sang da_doc_links.md! Tổng số link đã đọc: {result.get('archive_count')}, Inbox hiện tại: {result.get('inbox_count')}"
    )
