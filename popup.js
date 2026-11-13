/**
 * @file popup.js
 * @description GomLink Spatial - Glassmorphism Popup Interface Logic
 * Handles interactive cards view, raw markdown editor, clipboard copying, and live synchronization.
 */

const BRIDGE_URL = "http://127.0.0.1:18999";

const textarea = /** @type {HTMLTextAreaElement} */ (document.getElementById("note"));
const cardsView = /** @type {HTMLElement} */ (document.getElementById("cards-view"));
const statusEl = /** @type {HTMLElement} */ (document.getElementById("status"));
const inboxStatEl = /** @type {HTMLElement} */ (document.getElementById("inbox-stat"));
const archiveStatEl = /** @type {HTMLElement} */ (document.getElementById("archive-stat"));
const sourceStatEl = /** @type {HTMLElement} */ (document.getElementById("source-stat"));
const toggleViewBtn = /** @type {HTMLButtonElement} */ (document.getElementById("toggle-view-btn"));
const addCurrentBtn = /** @type {HTMLButtonElement} */ (document.getElementById("add-current-btn"));
const copyBtn = /** @type {HTMLButtonElement} */ (document.getElementById("copy"));
const copyUrlsBtn = /** @type {HTMLButtonElement} */ (document.getElementById("copy-urls"));
const clearBtn = /** @type {HTMLButtonElement} */ (document.getElementById("clear"));

let isRawMode = false;

/**
 * Cập nhật badge trên icon extension
 * @param {number} count
 */
async function updateBadge(count) {
  if (typeof chrome !== "undefined" && chrome.action && chrome.action.setBadgeText) {
    try {
      await chrome.action.setBadgeText({ text: count > 0 ? String(count) : "" });
      await chrome.action.setBadgeBackgroundColor({ color: "#10b981" });
    } catch (err) {
      console.warn("[GomLink Popup] Không thể cập nhật badge:", err);
    }
  }
}

/**
 * Hiệu ứng nhấp nháy chữ trên nút bấm khi người dùng thao tác (DRY helper)
 * @param {HTMLButtonElement} btn
 * @param {string} feedbackText
 * @param {number} [duration]
 */
function flashButton(btn, feedbackText, duration = 1400) {
  if (!btn) return;
  const original = btn.innerText;
  btn.innerText = feedbackText;
  btn.disabled = true;
  setTimeout(() => {
    btn.innerText = original;
    btn.disabled = false;
  }, duration);
}

/**
 * Hiển thị danh sách card dạng kính mờ từ nội dung text markdown
 * @param {string} noteText
 * @param {number} [archiveCount]
 */
function renderCards(noteText, archiveCount = 0) {
  const lines = GomLinkUtils.filterValidLines(noteText || "");

  inboxStatEl.textContent = String(lines.length);
  archiveStatEl.textContent = String(archiveCount);

  if (lines.length === 0) {
    sourceStatEl.textContent = "Trống";
    cardsView.innerHTML = `
      <div class="glass-panel empty-state">
        <div class="empty-orb">🫧</div>
        <h3>Hàng đợi đang trống</h3>
        <p>Vừa lướt web vừa bấm <b>Click trái vào Icon</b> hoặc <kbd>Alt</kbd> + <kbd>S</kbd> để gom link ngầm vào sổ.</p>
      </div>
    `;
    return;
  }

  const parsed = lines.map((line, idx) => GomLinkUtils.parseLineItem(line, idx));

  // Thống kê nguồn nhiều nhất
  const counts = {};
  parsed.forEach((item) => {
    counts[item.platform] = (counts[item.platform] || 0) + 1;
  });
  const topPlatform = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  sourceStatEl.textContent = topPlatform ? topPlatform[0] : "Đa nguồn";

  cardsView.innerHTML = "";
  parsed.forEach((item) => {
    const card = document.createElement("div");
    card.className = "link-card";

    // Card Left: Icon + Info
    const cardLeft = document.createElement("div");
    cardLeft.className = "card-left";

    const platformIcon = document.createElement("div");
    platformIcon.className = "platform-icon";
    platformIcon.textContent = item.icon;

    const cardInfo = document.createElement("div");
    cardInfo.className = "card-info";

    const titleRow = document.createElement("div");
    titleRow.className = "card-title-row";

    const platformTag = document.createElement("span");
    platformTag.className = "platform-tag";
    platformTag.textContent = item.platform;

    const cardTitle = document.createElement("span");
    cardTitle.className = "card-title";
    cardTitle.title = item.title;
    cardTitle.textContent = item.title;

    titleRow.appendChild(platformTag);
    titleRow.appendChild(cardTitle);

    const cardUrl = document.createElement("a");
    cardUrl.className = "card-url";
    cardUrl.href = item.url;
    cardUrl.target = "_blank";
    cardUrl.rel = "noopener noreferrer";
    cardUrl.title = item.url;
    cardUrl.textContent = item.shortUrl || item.url;

    cardInfo.appendChild(titleRow);
    cardInfo.appendChild(cardUrl);

    cardLeft.appendChild(platformIcon);
    cardLeft.appendChild(cardInfo);

    // Card Actions: Copy + Delete
    const cardActions = document.createElement("div");
    cardActions.className = "card-actions";

    const copyBtnOne = document.createElement("button");
    copyBtnOne.className = "icon-btn copy-one";
    copyBtnOne.title = "Copy link này";
    copyBtnOne.textContent = "📋";
    copyBtnOne.onclick = async () => {
      try {
        await navigator.clipboard.writeText(item.url || item.rawLine);
        statusEl.textContent = "✅ Đã copy 1 link!";
        setTimeout(() => (statusEl.textContent = "Đồng bộ trực tiếp"), 2000);
      } catch (err) {
        console.warn("[GomLink Popup] Clipboard write error:", err);
      }
    };

    const delBtn = document.createElement("button");
    delBtn.className = "icon-btn del";
    delBtn.title = "Xóa khỏi hàng đợi";
    delBtn.textContent = "✕";
    delBtn.onclick = async () => {
      const remaining = lines.filter((_, i) => i !== item.index).join("\n");
      const finalNote = remaining ? remaining + "\n" : "";
      await saveNoteText(finalNote, archiveCount);
      statusEl.textContent = "🗑️ Đã xóa 1 mục";
    };

    cardActions.appendChild(copyBtnOne);
    cardActions.appendChild(delBtn);

    card.appendChild(cardLeft);
    card.appendChild(cardActions);
    cardsView.appendChild(card);
  });
}

/**
 * Lưu chuỗi markdown vào Chrome Storage & gửi cập nhật sang Bridge Server
 * @param {string} newText
 * @param {number|null} [archiveCount]
 */
async function saveNoteText(newText, archiveCount = null) {
  textarea.value = newText;
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    await chrome.storage.local.set({ note: newText });
  }

  try {
    const res = await fetch(`${BRIDGE_URL}/update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: newText }),
    });
    if (res.ok) {
      const data = await res.json();
      const currentArchiveCount = data.archive_count ?? archiveCount ?? 0;
      await updateBadge(Number(data.inbox_count) || 0);
      renderCards(newText, currentArchiveCount);
      return;
    }
  } catch (e) {
    console.info("[GomLink Popup] Bridge offline, lưu cục bộ thành công");
  }

  const count = GomLinkUtils.countValidLines(newText);
  await updateBadge(count);
  renderCards(newText, archiveCount || 0);
}

/**
 * Tải danh sách inbox hiện tại từ Bridge Server hoặc fallback Local Storage
 */
async function loadCurrentInbox() {
  try {
    const res = await fetch(`${BRIDGE_URL}/status`);
    if (res.ok) {
      const data = await res.json();
      textarea.value = data.note || "";
      const inboxCount = Number(data.inbox_count) || 0;
      const archiveCount = Number(data.archive_count) || 0;
      statusEl.textContent = `Đồng bộ trực tiếp (${inboxCount} link)`;
      await updateBadge(inboxCount);
      renderCards(data.note || "", archiveCount);
      return;
    }
  } catch (e) {
    console.info("[GomLink Popup] Bridge server không kết nối được, chuyển sang chế độ Local");
  }

  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    const localData = await chrome.storage.local.get({ note: "" });
    textarea.value = localData.note || "";
    statusEl.textContent = "Chế độ Trình duyệt (Local)";
    renderCards(localData.note || "", 0);
  }
}

// Chuyển đổi giữa chế độ Xem Thẻ Kính (Cards) và Soạn thảo Thô (Raw Markdown)
toggleViewBtn.onclick = () => {
  isRawMode = !isRawMode;
  if (isRawMode) {
    cardsView.style.display = "none";
    textarea.style.display = "block";
    toggleViewBtn.classList.add("active");
    toggleViewBtn.innerText = "🗂️ Thẻ Kính";
  } else {
    cardsView.style.display = "flex";
    textarea.style.display = "none";
    toggleViewBtn.classList.remove("active");
    toggleViewBtn.innerText = "📝 Sửa Raw";
    renderCards(textarea.value, Number(archiveStatEl.textContent) || 0);
  }
};

// Lưu tab hiện tại đang duyệt vào sổ
addCurrentBtn.onclick = () => {
  if (typeof chrome === "undefined" || !chrome.tabs) return;
  chrome.tabs.query({ active: true, currentWindow: true }, async ([tab]) => {
    if (!tab || !tab.url || GomLinkUtils.isSystemUrl(tab.url)) {
      statusEl.textContent = "⚠️ Tab hệ thống không thể lưu";
      return;
    }

    const cleanTitle = GomLinkUtils.sanitizeTitle(tab.title);

    try {
      const res = await fetch(`${BRIDGE_URL}/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: cleanTitle, url: tab.url, force: true }),
      });
      if (res.ok) {
        const data = await res.json();
        textarea.value = data.note || "";
        await updateBadge(Number(data.inbox_count) || 0);
        renderCards(data.note || "", Number(data.archive_count) || 0);
        statusEl.textContent = "✅ Đã thêm tab hiện tại!";
        return;
      }
    } catch (e) {
      console.info("[GomLink Popup] Bridge offline, thêm tab vào local storage");
    }

    // Fallback chế độ Standalone không cần Bridge
    const localData = await chrome.storage.local.get({ note: "" });
    let currentNote = localData.note || "";
    if (!currentNote.includes(tab.url)) {
      currentNote += GomLinkUtils.formatMarkdownLine(cleanTitle, tab.url);
      await saveNoteText(currentNote, 0);
      statusEl.textContent = "✅ Đã thêm tab hiện tại!";
    } else {
      statusEl.textContent = "📌 Tab này đã có trong Sổ";
    }
  });
};

// Tự động lưu khi sửa trên textarea ở chế độ Raw
textarea.addEventListener("input", async () => {
  await saveNoteText(textarea.value, Number(archiveStatEl.textContent) || 0);
});

// Copy toàn bộ Markdown để gửi vào Chat của AI Agent (Antigravity/Claude/GPT)
copyBtn.onclick = async () => {
  try {
    await navigator.clipboard.writeText(textarea.value);
    flashButton(copyBtn, "✅ Đã Copy!");
  } catch (err) {
    console.warn("[GomLink Popup] Copy clipboard failed:", err);
  }
};

// Chỉ trích xuất danh sách URLs thuần
copyUrlsBtn.onclick = async () => {
  try {
    const urls = GomLinkUtils.extractAllUrls(textarea.value);
    const content = urls.length > 0 ? urls.join("\n") : textarea.value;
    await navigator.clipboard.writeText(content);
    flashButton(copyUrlsBtn, "✅ Đã Copy URLs!");
  } catch (err) {
    console.warn("[GomLink Popup] Copy URLs failed:", err);
  }
};

// Dọn dẹp sạch Sổ
clearBtn.onclick = async () => {
  await saveNoteText("", Number(archiveStatEl.textContent) || 0);
  statusEl.textContent = "🗑️ Đã dọn sạch Sổ";
};

// Chạy khởi tạo giao diện
loadCurrentInbox();
