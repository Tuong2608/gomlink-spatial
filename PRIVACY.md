# Privacy Policy — GomLink Spatial

**Product:** GomLink Spatial — Quick Link Collector for AI Agents (for Microsoft Edge)  
**Publisher:** Jun_268 (`Tuong2608`)  
**Effective Date:** November 13, 2026  
**Last Updated:** November 13, 2026

---

## 1. Overview

**GomLink Spatial — Quick Link Collector for AI Agents** ("GomLink Spatial", "the Extension") is an open-source Microsoft Edge extension designed with a strict local-first architecture. We respect your privacy and do **not** collect, transmit, track, sell, or share your personal information or browsing activity with any external servers or third parties.

All link collection and storage happen locally inside your **Microsoft Edge** browser and, optionally, on your own computer via a local loopback bridge that you explicitly run.

---

## 2. Information Accessed and Stored

GomLink Spatial accesses only the minimal information required to perform its core link-saving feature:

1. **Web Page URL and Title (User-Initiated Only):**
   - When you explicitly click the extension icon, press the keyboard shortcut (`Alt+S`), click **Save Current Tab** in the popup, or select **Save link to notebook** from the Microsoft Edge context menu, the extension reads the target tab or link's **URL** and **title**.
   - Browser internal/system pages (such as `edge://`, `about:`, and `view-source:`) are automatically ignored and never saved.
   - Your general browsing history is never monitored, logged, or uploaded.

2. **Local Extension Storage (`storage.local`):**
   - Your saved link list (formatted as Markdown lines) and a local synchronization timestamp token (`clear_token`) are stored locally within Microsoft Edge's extension storage (`chrome.storage.local`).

3. **Optional Localhost Bridge (`http://127.0.0.1:18999`):**
   - If you voluntarily run the accompanying local Python bridge server (`bridge_server.py`) on your own device, the extension exchanges your saved link list strictly over your computer's local loopback interface (`http://127.0.0.1:18999`) to store them in local Markdown files (`inbox_links.md` and `da_doc_links.md`) for your local AI workflows.
   - If the local bridge is not running, the extension operates 100% standalone inside Microsoft Edge local storage with no network calls.

---

## 3. Permissions Used in Microsoft Edge

| Permission | Purpose |
| :--- | :--- |
| `tabs` | Reads the active tab's URL and title strictly when you trigger a save action, and triggers local badge/storage synchronization when switching tabs. |
| `storage` | Persists your saved Markdown links and local sync state inside Microsoft Edge (`storage.local`). |
| `contextMenus` | Adds quick actions to Microsoft Edge's right-click menu (open notebook, clear notebook, save a link or page). |
| `alarms` | Schedules lightweight periodic synchronization between Microsoft Edge local storage and the optional localhost bridge (`127.0.0.1:18999`). |
| `host_permissions` (`http://127.0.0.1:18999/*`) | Strictly scoped to your local machine's loopback address (`127.0.0.1`) for optional local Markdown file synchronization. No external domains are accessed. |

---

## 4. Data Sharing, Analytics, and Third Parties

- **No Remote Servers:** GomLink Spatial has no backend server outside your device.
- **No Analytics or Telemetry:** The extension contains zero tracking scripts, telemetry, advertising SDKs, or third-party cookies.
- **No Third-Party Disclosure:** Your saved links and browsing data are never sold, rented, or shared with the developer or any third party.

---

## 5. User Controls, Access, and Data Deletion

You have full control over your data at all times:

- **View, Edit, and Copy:** Open the extension notebook (right-click the extension icon → **Open Notebook**) to inspect all saved links in Cards view or Raw Markdown mode, or copy them to your clipboard.
- **Delete Individual Items or Clear All:** Remove any single link card, clear the entire list via the **Clear** button in the popup, or use the right-click toolbar menu (**Clear Notebook**).
- **Local Files & Bridge Control:** Stop `bridge_server.py` at any time to disable local disk synchronization, and delete `inbox_links.md`, `da_doc_links.md`, or `sync_state.json` directly from your file system.
- **Complete Removal:** Uninstalling GomLink Spatial from Microsoft Edge (`edge://extensions`) permanently deletes all data stored in Microsoft Edge's local extension storage.

---

## 6. Changes to This Privacy Policy

If future updates to GomLink Spatial introduce new features or change how information is handled, this Privacy Policy will be updated accordingly before release, with an updated "Last Updated" date at the top of this document.

---

## 7. Contact Us

If you have any questions, requests, or concerns regarding this Privacy Policy or how GomLink Spatial handles data in Microsoft Edge, please open an issue on our official GitHub repository:

- **GitHub Issues (Support & Privacy Inquiries):** [https://github.com/Tuong2608/gomlink-spatial/issues](https://github.com/Tuong2608/gomlink-spatial/issues)
- **Source Code Repository:** [https://github.com/Tuong2608/gomlink-spatial](https://github.com/Tuong2608/gomlink-spatial)
