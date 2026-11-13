/**
 * @file background.js
 * @description GomLink Spatial - Manifest V3 Background Service Worker
 * Handles background link capture, keyboard shortcuts, context menus, and synchronization with Bridge Server.
 */

// Nạp bộ tiện ích thuần link_utils.js cho Service Worker
try {
  importScripts("link_utils.js");
} catch (err) {
  console.error("[GomLink Background] Không thể import link_utils.js:", err);
}

const BRIDGE_URL = "http://127.0.0.1:18999";

/**
 * Cập nhật số lượng link hiển thị trên icon Extension (Badge)
 * @param {number} count
 * @param {string|null} [tempText]
 * @param {string|null} [tempColor]
 */
async function updateBadgeFromCount(count, tempText = null, tempColor = null) {
  try {
    if (tempText !== null) {
      await chrome.action.setBadgeText({ text: String(tempText) });
      await chrome.action.setBadgeBackgroundColor({ color: tempColor || "#f59e0b" });
      setTimeout(() => {
        syncWithBridge().catch((err) =>
          console.warn("[GomLink Background] syncWithBridge sau badge thất bại:", err)
        );
      }, 1200);
      return;
    }
    const badgeText = count > 0 ? String(count) : "";
    await chrome.action.setBadgeText({ text: badgeText });
    await chrome.action.setBadgeBackgroundColor({ color: "#10b981" });
  } catch (err) {
    console.warn("[GomLink Background] Lỗi cập nhật badge:", err);
  }
}

/**
 * Đồng bộ 2 chiều giữa chrome.storage.local và inbox_links.md
 * @returns {Promise<any|null>}
 */
async function syncWithBridge() {
  const localData = await chrome.storage.local.get({ note: "", clear_token: 0 });
  try {
    const res = await fetch(`${BRIDGE_URL}/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        local_note: localData.note || "",
        clear_token: Number(localData.clear_token) || 0,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      await chrome.storage.local.set({
        note: data.note || "",
        clear_token: Number(data.clear_token) || 0,
      });
      await updateBadgeFromCount(Number(data.inbox_count) || 0);
      return data;
    } else {
      console.warn(`[GomLink Background] Bridge /sync trả về mã lỗi: ${res.status}`);
    }
  } catch (e) {
    // Chế độ Standalone nếu Bridge Server chưa bật
    const validLines = GomLinkUtils.filterValidLines(localData.note || "");
    await updateBadgeFromCount(validLines.length);
  }
  return null;
}

/**
 * Hàm thêm 1 dòng link vào inbox_links.md (ngầm 100%, không bật popup)
 * @param {string} [title]
 * @param {string} [url]
 * @param {boolean} [force]
 */
async function appendLinkToNote(title, url, force = false) {
  if (!url || GomLinkUtils.isSystemUrl(url)) {
    return;
  }

  const cleanTitle = GomLinkUtils.sanitizeTitle(title);

  try {
    await syncWithBridge();
    const res = await fetch(`${BRIDGE_URL}/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: cleanTitle, url, force: Boolean(force) }),
    });

    if (res.ok) {
      const data = await res.json();
      await chrome.storage.local.set({
        note: data.note || "",
        clear_token: Number(data.clear_token) || 0,
      });

      if (data.status === "already_read") {
        await updateBadgeFromCount(Number(data.inbox_count) || 0, "OLD", "#f59e0b");
      } else if (data.status === "already_in_inbox") {
        await updateBadgeFromCount(Number(data.inbox_count) || 0, "ĐÃ CÓ", "#3b82f6");
      } else {
        await updateBadgeFromCount(Number(data.inbox_count) || 0);
      }
      return data;
    }
  } catch (e) {
    // Fallback chế độ Standalone (không cần bật Bridge Server)
    const data = await chrome.storage.local.get({ note: "" });
    let currentNote = data.note || "";
    const lines = GomLinkUtils.filterValidLines(currentNote);

    if (currentNote.includes(url)) {
      await updateBadgeFromCount(lines.length, "ĐÃ CÓ", "#3b82f6");
      return;
    }

    currentNote += GomLinkUtils.formatMarkdownLine(cleanTitle, url);
    await chrome.storage.local.set({ note: currentNote });
    await updateBadgeFromCount(lines.length + 1);
  }
}

/**
 * Mở bảng Sổ Gom Link khi người dùng chủ động yêu cầu (Chuột phải -> Mở Sổ)
 */
async function openNotePopup() {
  try {
    await chrome.action.setPopup({ popup: "popup.html" });
    await chrome.action.openPopup();
    setTimeout(() => {
      chrome.action
        .setPopup({ popup: "" })
        .catch((err) => console.warn("[GomLink Background] Lỗi reset popup:", err));
    }, 400);
  } catch (e) {
    chrome.windows.create({
      url: chrome.runtime.getURL("popup.html"),
      type: "popup",
      width: 455,
      height: 540,
    });
  }
}

/**
 * Thiết lập các Context Menu trong trình duyệt
 */
function setupMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "open-note-popup",
      title: "📒 Mở Sổ Gom Link (Xem / Sửa / Copy)",
      contexts: ["action"],
    });
    chrome.contextMenus.create({
      id: "clear-note-quick",
      title: "🗑️ Xóa trắng Sổ Gom Link",
      contexts: ["action"],
    });
    chrome.contextMenus.create({
      id: "gom-link-item",
      title: "➕ Gom link này vào Sổ",
      contexts: ["link", "page"],
    });
  });
}

// Khởi tạo Extension
chrome.runtime.onInstalled.addListener(async () => {
  await chrome.action.setPopup({ popup: "" });
  setupMenus();
  await syncWithBridge();
  chrome.alarms.create("sync-inbox", { periodInMinutes: 0.5 });
});

chrome.runtime.onStartup.addListener(async () => {
  await chrome.action.setPopup({ popup: "" });
  setupMenus();
  await syncWithBridge();
});

// CLICK TRÁI VÀO ICON: Lưu ngầm ngay lập tức, KHÔNG hiện bảng Popup!
chrome.action.onClicked.addListener(async (tab) => {
  if (tab && tab.url) {
    await appendLinkToNote(tab.title, tab.url);
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "sync-inbox") {
    syncWithBridge().catch((err) =>
      console.warn("[GomLink Background] Lỗi sync hẹn giờ:", err)
    );
  }
});

chrome.tabs.onActivated.addListener(() => {
  syncWithBridge().catch((err) =>
    console.warn("[GomLink Background] Lỗi sync khi chuyển tab:", err)
  );
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "open-note-popup") {
    await openNotePopup();
  } else if (info.menuItemId === "clear-note-quick") {
    await chrome.storage.local.set({ note: "" });
    try {
      await fetch(`${BRIDGE_URL}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: "" }),
      });
    } catch (e) {
      console.info("[GomLink Background] Cập nhật offline khi xóa nhanh sổ");
    }
    await updateBadgeFromCount(0);
  } else if (info.menuItemId === "gom-link-item") {
    const targetUrl = info.linkUrl || info.pageUrl || (tab && tab.url);
    const targetTitle = info.selectionText || (tab && tab.title) || "Link đã lưu";
    await appendLinkToNote(targetTitle, targetUrl);
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command === "add-link") {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) {
      await appendLinkToNote(tab.title, tab.url);
    }
  }
});
