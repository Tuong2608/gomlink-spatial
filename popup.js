const BRIDGE_URL = "http://127.0.0.1:18999";
const textarea = document.getElementById("note");
const cardsView = document.getElementById("cards-view");
const statusEl = document.getElementById("status");
const inboxStatEl = document.getElementById("inbox-stat");
const archiveStatEl = document.getElementById("archive-stat");
const sourceStatEl = document.getElementById("source-stat");
const toggleViewBtn = document.getElementById("toggle-view-btn");
const addCurrentBtn = document.getElementById("add-current-btn");
const copyBtn = document.getElementById("copy");
const copyUrlsBtn = document.getElementById("copy-urls");
const clearBtn = document.getElementById("clear");

let isRawMode = false;

async function updateBadge(count) {
  if (typeof chrome !== "undefined" && chrome.action) {
    await chrome.action.setBadgeText({ text: count > 0 ? String(count) : "" });
    await chrome.action.setBadgeBackgroundColor({ color: "#10b981" });
  }
}

function parseLineItem(rawLine, index) {
  const line = rawLine.trim();
  const urlMatch = line.match(/https?:\/\/[^\s|]+/);
  const url = urlMatch ? urlMatch[0] : "";

  let rawTitle = line
    .replace(/^-+\s*/, "")
    .replace(url, "")
    .replace(/\|\s*$/, "")
    .trim();

  let platform = "Web";
  let icon = "🌐";
  let displayTitle = rawTitle || "Link đã lưu";
  let shortUrl = url.replace(/^https?:\/\/(www\.)?/, "");

  if (url.includes("tiktok.com")) {
    platform = "TikTok";
    icon = "🎵";
    const userMatch = url.match(/tiktok\.com\/(@[^/]+)\/(video|photo)\/(\d+)/);
    if (userMatch) {
      const handle = userMatch[1];
      const kind = userMatch[2] === "photo" ? "Ảnh trượt" : "Video";
      const idTail = userMatch[3].slice(-4);
      if (!rawTitle || rawTitle.includes("(@") || rawTitle === "TikTok") {
        displayTitle = `${handle} • ${kind} #${idTail}`;
      } else {
        displayTitle = rawTitle.replace(/\s*\|\s*TikTok$/i, "");
      }
      shortUrl = `${handle}/${userMatch[2]}/${userMatch[3]}`;
    }
  } else if (url.includes("github.com")) {
    platform = "GitHub";
    icon = "🐙";
    const repoMatch = url.match(/github\.com\/([^/]+\/[^/?#]+)/);
    if (repoMatch) {
      shortUrl = repoMatch[1];
    }
  } else if (url.includes("youtube.com") || url.includes("youtu.be")) {
    platform = "YouTube";
    icon = "▶️";
    displayTitle = displayTitle.replace(/\s*-\s*YouTube$/i, "");
  } else if (url.includes("facebook.com") || url.includes("fb.watch")) {
    platform = "Facebook";
    icon = "📘";
  } else if (url.includes("x.com") || url.includes("twitter.com")) {
    platform = "X";
    icon = "𝕏";
  }

  return { index, rawLine, title: displayTitle, url, shortUrl, platform, icon };
}

function renderCards(noteText, archiveCount = 0) {
  const lines = (noteText || "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#") && !l.startsWith(">"));

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

  const parsed = lines.map((l, idx) => parseLineItem(l, idx));

  const counts = {};
  parsed.forEach((item) => {
    counts[item.platform] = (counts[item.platform] || 0) + 1;
  });
  const topPlatform = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  sourceStatEl.textContent = topPlatform ? `${topPlatform[0]}` : "Đa nguồn";

  cardsView.innerHTML = "";
  parsed.forEach((item) => {
    const card = document.createElement("div");
    card.className = "link-card";
    card.innerHTML = `
      <div class="card-left">
        <div class="platform-icon">${item.icon}</div>
        <div class="card-info">
          <div class="card-title-row">
            <span class="platform-tag">${item.platform}</span>
            <span class="card-title" title="${item.title.replace(/"/g, "&quot;")}">${item.title}</span>
          </div>
          <a class="card-url" href="${item.url}" target="_blank" title="${item.url}">${item.shortUrl}</a>
        </div>
      </div>
      <div class="card-actions">
        <button class="icon-btn copy-one" title="Copy link này">📋</button>
        <button class="icon-btn del" title="Xóa khỏi hàng đợi">✕</button>
      </div>
    `;

    card.querySelector(".copy-one").onclick = async () => {
      await navigator.clipboard.writeText(item.url || item.rawLine);
      statusEl.textContent = "✅ Đã copy 1 link!";
    };

    card.querySelector(".del").onclick = async () => {
      const remaining = lines.filter((_, i) => i !== item.index).join("\n");
      const finalNote = remaining ? remaining + "\n" : "";
      await saveNoteText(finalNote, archiveCount);
      statusEl.textContent = "🗑️ Đã xóa 1 mục";
    };

    cardsView.appendChild(card);
  });
}

async function saveNoteText(newText, archiveCount = null) {
  textarea.value = newText;
  if (typeof chrome !== "undefined" && chrome.storage) {
    await chrome.storage.local.set({ note: newText });
  }
  try {
    const res = await fetch(`${BRIDGE_URL}/update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: newText })
    });
    if (res.ok) {
      const data = await res.json();
      await updateBadge(data.inbox_count || 0);
      renderCards(newText, data.archive_count ?? archiveCount ?? 0);
      return;
    }
  } catch (e) {}

  const count = newText.split("\n").filter((l) => l.trim().length > 0).length;
  await updateBadge(count);
  renderCards(newText, archiveCount || 0);
}

async function loadCurrentInbox() {
  try {
    const res = await fetch(`${BRIDGE_URL}/status`);
    if (res.ok) {
      const data = await res.json();
      textarea.value = data.note || "";
      statusEl.textContent = `Đồng bộ trực tiếp (${data.inbox_count || 0} link)`;
      await updateBadge(data.inbox_count || 0);
      renderCards(data.note || "", data.archive_count || 0);
      return;
    }
  } catch (e) {}

  if (typeof chrome !== "undefined" && chrome.storage) {
    const localData = await chrome.storage.local.get({ note: "" });
    textarea.value = localData.note || "";
    statusEl.textContent = "Chế độ Trình duyệt (Local)";
    renderCards(localData.note || "", 0);
  }
}

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

addCurrentBtn.onclick = () => {
  if (typeof chrome === "undefined" || !chrome.tabs) return;
  chrome.tabs.query({ active: true, currentWindow: true }, async ([tab]) => {
    if (!tab || !tab.url || tab.url.startsWith("chrome://") || tab.url.startsWith("edge://")) {
      statusEl.textContent = "⚠️ Tab hệ thống không thể lưu";
      return;
    }
    try {
      const res = await fetch(`${BRIDGE_URL}/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: tab.title, url: tab.url, force: true })
      });
      if (res.ok) {
        const data = await res.json();
        textarea.value = data.note || "";
        await updateBadge(data.inbox_count || 0);
        renderCards(data.note || "", data.archive_count || 0);
        statusEl.textContent = "✅ Đã thêm tab hiện tại!";
        return;
      }
    } catch (e) {}

    // Fallback chế độ Standalone không cần Bridge
    const localData = await chrome.storage.local.get({ note: "" });
    let currentNote = localData.note || "";
    if (!currentNote.includes(tab.url)) {
      const cleanTitle = (tab.title || "Không tiêu đề").replace(/\r?\n/g, " ").trim();
      currentNote += `- ${cleanTitle} | ${tab.url}\n`;
      await saveNoteText(currentNote, 0);
      statusEl.textContent = "✅ Đã thêm tab hiện tại!";
    } else {
      statusEl.textContent = "📌 Tab này đã có trong Sổ";
    }
  });
};

textarea.addEventListener("input", async () => {
  await saveNoteText(textarea.value, Number(archiveStatEl.textContent) || 0);
});

copyBtn.onclick = async () => {
  await navigator.clipboard.writeText(textarea.value);
  const original = copyBtn.innerText;
  copyBtn.innerText = "✅ Đã Copy!";
  setTimeout(() => (copyBtn.innerText = original), 1400);
};

copyUrlsBtn.onclick = async () => {
  const urls = textarea.value
    .split("\n")
    .map((line) => {
      const match = line.match(/https?:\/\/[^\s|]+/);
      return match ? match[0] : null;
    })
    .filter(Boolean)
    .join("\n");

  await navigator.clipboard.writeText(urls || textarea.value);
  const original = copyUrlsBtn.innerText;
  copyUrlsBtn.innerText = "✅ Đã Copy URLs!";
  setTimeout(() => (copyUrlsBtn.innerText = original), 1400);
};

clearBtn.onclick = async () => {
  await saveNoteText("", Number(archiveStatEl.textContent) || 0);
  statusEl.textContent = "🗑️ Đã dọn sạch Sổ";
};

loadCurrentInbox();
