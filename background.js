const BRIDGE_URL = "http://127.0.0.1:18999";

// Cập nhật số lượng link hiển thị trên icon Extension (Badge)
async function updateBadgeFromCount(count, tempText = null, tempColor = null) {
  if (tempText !== null) {
    await chrome.action.setBadgeText({ text: tempText });
    await chrome.action.setBadgeBackgroundColor({ color: tempColor || "#f59e0b" });
    setTimeout(() => {
      syncWithBridge();
    }, 1200);
    return;
  }
  await chrome.action.setBadgeText({ text: count > 0 ? String(count) : "" });
  await chrome.action.setBadgeBackgroundColor({ color: "#10b981" });
}

// Đồng bộ 2 chiều giữa chrome.storage.local và inbox_links.md
async function syncWithBridge() {
  const localData = await chrome.storage.local.get({ note: "", clear_token: 0 });
  try {
    const res = await fetch(`${BRIDGE_URL}/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        local_note: localData.note || "",
        clear_token: localData.clear_token || 0
      })
    });
    if (res.ok) {
      const data = await res.json();
      await chrome.storage.local.set({
        note: data.note || "",
        clear_token: data.clear_token || 0
      });
      await updateBadgeFromCount(data.inbox_count || 0);
      return data;
    }
  } catch (e) {
    const lines = (localData.note || "")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    await updateBadgeFromCount(lines.length);
  }
  return null;
}

// Hàm thêm 1 dòng link vào inbox_links.md (ngầm 100%, không bật popup)
async function appendLinkToNote(title, url, force = false) {
  if (!url || url.startsWith("chrome://") || url.startsWith("edge://")) return;

  try {
    await syncWithBridge();
    const res = await fetch(`${BRIDGE_URL}/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, url, force })
    });
    if (res.ok) {
      const data = await res.json();
      await chrome.storage.local.set({
        note: data.note || "",
        clear_token: data.clear_token || 0
      });
      if (data.status === "already_read") {
        await updateBadgeFromCount(data.inbox_count || 0, "OLD", "#f59e0b");
      } else if (data.status === "already_in_inbox") {
        await updateBadgeFromCount(data.inbox_count || 0, "ĐÃ CÓ", "#3b82f6");
      } else {
        await updateBadgeFromCount(data.inbox_count || 0);
      }
      return data;
    }
  } catch (e) {
    // Chế độ Standalone (không cần bật Bridge Server)
    const data = await chrome.storage.local.get({ note: "" });
    let currentNote = data.note || "";
    const lines = currentNote.split("\n").filter((l) => l.trim().length > 0);
    if (currentNote.includes(url)) {
      await updateBadgeFromCount(lines.length, "ĐÃ CÓ", "#3b82f6");
      return;
    }
    const cleanTitle = (title || "Không tiêu đề").replace(/\r?\n/g, " ").trim();
    currentNote += `- ${cleanTitle} | ${url}\n`;
    await chrome.storage.local.set({ note: currentNote });
    await updateBadgeFromCount(lines.length + 1);
  }
}

// Mở bảng Sổ Gom Link khi người dùng chủ động yêu cầu (Chuột phải -> Mở Sổ)
async function openNotePopup() {
  try {
    await chrome.action.setPopup({ popup: "popup.html" });
    await chrome.action.openPopup();
    setTimeout(() => {
      chrome.action.setPopup({ popup: "" });
    }, 300);
  } catch (e) {
    chrome.windows.create({
      url: chrome.runtime.getURL("popup.html"),
      type: "popup",
      width: 455,
      height: 540
    });
  }
}

function setupMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "open-note-popup",
      title: "📒 Mở Sổ Gom Link (Xem / Sửa / Copy)",
      contexts: ["action"]
    });
    chrome.contextMenus.create({
      id: "clear-note-quick",
      title: "🗑️ Xóa trắng Sổ Gom Link",
      contexts: ["action"]
    });
    chrome.contextMenus.create({
      id: "gom-link-item",
      title: "➕ Gom link này vào Sổ",
      contexts: ["link", "page"]
    });
  });
}

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
    syncWithBridge();
  }
});

chrome.tabs.onActivated.addListener(() => {
  syncWithBridge();
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
        body: JSON.stringify({ note: "" })
      });
    } catch (e) {}
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
