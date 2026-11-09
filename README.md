# ✨ GomLink Spatial — 1-Click Silent Link Collector for AI Agents

> **Giải pháp thay thế OneTab chuẩn bài:** Vừa lướt TikTok, YouTube, GitHub hay bài báo → bấm **Click trái vào Icon** (hoặc `Alt + S`) là link tự động nhảy nối đuôi vào Sổ mà **KHÔNG làm tắt tab hiện tại** và **KHÔNG bật bảng Popup gây gián đoạn**.

![Manifest V3](https://img.shields.io/badge/Chrome_&_Edge-Manifest_V3-10b981?style=for-the-badge&logo=googlechrome&logoColor=white)
![UI Style](https://img.shields.io/badge/UI-Spatial_Glassmorphism-38bdf8?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-f59e0b?style=for-the-badge)

---

## 🔥 Tại sao lại cần GomLink Spatial thay vì OneTab?

| Tính năng | OneTab truyền thống | ✨ GomLink Spatial |
| :--- | :--- | :--- |
| **Khi bấm lưu link** | Bắt gom toàn bộ tab hoặc **đóng mất tab đang xem** | **Lưu ngầm 100%** (Tab giữ nguyên, không hiện popup làm phiền) |
| **Phản hồi thị giác** | Mở sang một trang quản lý riêng | Nhảy số đếm trực tiếp trên Icon (`1`, `2`, `3`...), báo `ĐÃ CÓ` / `OLD` nếu trùng |
| **Giao diện quản lý** | Danh sách chữ trắng đơn điệu | **Spatial Glassmorphism** (Thẻ kính mờ VisionOS + Chế độ sửa Raw Markdown) |
| **Kết nối AI Agent** | Phải tự copy/paste và tự xóa tay | Tự động đồng bộ 2 chiều với file `inbox_links.md` & lọc trùng qua `da_doc_links.md` |

---

## ✨ Tính năng nổi bật

1. **Click Trái Lưu Ngầm — Chuột Phải Mở Sổ:**
   - **Click chuột trái vào Icon** (hoặc bấm `Alt + S`, hoặc chuột phải vào link bất kỳ trên trang chọn *"➕ Gom link này vào Sổ"*): Link lập tức được nối đuôi vào danh sách mà không bật bất kỳ cửa sổ nào che màn hình.
   - **Click chuột phải vào Icon** → Chọn **`📒 Mở Sổ Gom Link`**: Mở bảng điều khiển kính mờ (Spatial Glassmorphism) để xem danh sách thẻ, copy gửi Agent hoặc xóa lẻ từng bài.
2. **Giao diện Spatial Glassmorphism 2 Chế Độ:**
   - **🗂️ Chế độ Thẻ Kính (Cards View):** Tự động nhận diện `TikTok`, `GitHub`, `YouTube`, `X`, `Facebook`, làm sạch tiêu đề rác và cho phép mở lại link, copy lẻ hoặc xóa lẻ từng thẻ.
   - **📝 Chế độ Sửa Raw (`📝 Sửa Raw`):** Chuyển nhanh sang khung soạn thảo Markdown thuần để chỉnh sửa hàng loạt.
3. **2 Chế độ Hoạt động linh hoạt:**
   - **Chế độ 1 — Standalone (Không cần cài đặt gì thêm):** Cài vào Chrome / Edge / Brave / Cốc Cốc là chạy ngay bằng bộ nhớ trình duyệt.
   - **Chế độ 2 — AI Agent Auto-Sync (`bridge_server.py`):** Dành cho người dùng **Google Antigravity, Claude Code, Cursor, OpenCode**. Tự động ghi thẳng link vào file `inbox_links.md` trên máy tính và chuyển các link AI đã phân tích sang `da_doc_links.md` để **không bao giờ đọc trùng lại link cũ**.

---

## 🚀 Hướng dẫn cài đặt (Chỉ 30 giây)

### Bước 1: Tải mã nguồn về máy
```bash
git clone https://github.com/Tuong2608/gomlink-spatial.git
```
*(Hoặc bấm **Code → Download ZIP** và giải nén ra một thư mục).*

### Bước 2: Nạp vào trình duyệt (Chrome / Edge / Brave / Cốc Cốc)
1. Mở trình duyệt, truy cập `chrome://extensions/` (hoặc `edge://extensions/`).
2. Bật công tắc **Developer mode (Chế độ nhà phát triển)** ở góc trên cùng bên phải.
3. Bấm **Load unpacked (Tải tiện ích đã giải nén)** → Chọn thư mục `gomlink-spatial`.
4. Bấm biểu tượng mảnh ghép 🧩 trên thanh trình duyệt → **Ghim (Pin)** icon **GomLink Spatial** ra ngoài.

---

## 🤖 (Tùy chọn) Kích hoạt Đồng bộ 2 chiều với AI Agent

Nếu bạn muốn AI Agent (như **Antigravity / Claude Code / Cursor**) tự động đọc file danh sách link trên ổ cứng và tự dọn sạch hàng đợi sau khi phân tích xong:

1. Chạy file `start_bridge.bat` (hoặc chạy lệnh):
   ```bash
   pythonw bridge_server.py
   ```
2. Cầu nối siêu nhẹ (`0% CPU`) sẽ lắng nghe tại `http://127.0.0.1:18999`:
   - Mỗi lần bạn bấm lưu trên trình duyệt, link tự động nối vào file **`inbox_links.md`**.
   - Khi bạn bảo AI Agent: *"Đọc và phân tích các link trong `inbox_links.md` rồi đánh dấu đã đọc"*, AI chỉ cần chạy:
     ```bash
     python mark_as_read.py
     ```
   - Toàn bộ link đã xử lý sẽ tự động chuyển sang **`da_doc_links.md`** (kèm mốc thời gian), đồng thời **`inbox_links.md`** và bộ đếm trên trình duyệt tự động reset về `0`!
   - Nếu lần sau bạn lướt web và vô tình bấm lưu lại một link cũ đã nằm trong `da_doc_links.md`, Icon trên trình duyệt sẽ nháy chữ **`OLD`** màu cam và tự động bỏ qua để AI không phải đọc lại.

---

## ⌨️ Bảng điều khiển tắt

| Thao tác | Hành động |
| :--- | :--- |
| **Click Chuột Trái vào Icon** | Lưu ngầm tab hiện tại vào Sổ (Không mở popup) |
| **`Alt + S`** | Phím tắt lưu ngầm tab hiện tại |
| **Click Chuột Phải vào Icon → `📒 Mở Sổ Gom Link`** | Mở giao diện Glassmorphism |
| **Click Chuột Phải vào Icon → `🗑️ Xóa trắng Sổ`** | Dọn sạch nhanh toàn bộ danh sách đang chờ |
| **Chuột Phải vào bất kỳ Link nào trên web** | Chọn `➕ Gom link này vào Sổ` mà không cần mở tab mới |

---

## 📄 License
Phát hành dưới giấy phép [MIT License](LICENSE). Tự do sử dụng, chỉnh sửa và chia sẻ!
