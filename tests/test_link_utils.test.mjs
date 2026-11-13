/**
 * @file test_link_utils.test.mjs
 * @description Unit tests for link_utils.js using Node.js native test runner (node:test).
 */

import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const GomLinkUtils = require("../link_utils.js");

test("isSystemUrl should correctly classify internal browser URLs", () => {
  assert.equal(GomLinkUtils.isSystemUrl("chrome://settings"), true);
  assert.equal(GomLinkUtils.isSystemUrl("chrome-extension://abcdef"), true);
  assert.equal(GomLinkUtils.isSystemUrl("edge://extensions"), true);
  assert.equal(GomLinkUtils.isSystemUrl("about:blank"), true);
  assert.equal(GomLinkUtils.isSystemUrl("view-source:https://google.com"), true);
  assert.equal(GomLinkUtils.isSystemUrl(""), true);
  assert.equal(GomLinkUtils.isSystemUrl(null), true);
  assert.equal(GomLinkUtils.isSystemUrl(undefined), true);

  assert.equal(GomLinkUtils.isSystemUrl("https://github.com"), false);
  assert.equal(GomLinkUtils.isSystemUrl("http://localhost:3000"), false);
});

test("sanitizeTitle should strip newlines and normalize multiple spaces", () => {
  assert.equal(GomLinkUtils.sanitizeTitle(""), "Không tiêu đề");
  assert.equal(GomLinkUtils.sanitizeTitle("   "), "Không tiêu đề");
  assert.equal(GomLinkUtils.sanitizeTitle(null), "Không tiêu đề");
  assert.equal(
    GomLinkUtils.sanitizeTitle("Bài báo AI\r\nvới nhiều\n dòng và  khoảng trống   "),
    "Bài báo AI với nhiều dòng và khoảng trống"
  );
});

test("extractUrlFromLine should pull out the first valid HTTP/HTTPS URL", () => {
  assert.equal(
    GomLinkUtils.extractUrlFromLine("- Google Search | https://google.com"),
    "https://google.com"
  );
  assert.equal(
    GomLinkUtils.extractUrlFromLine("https://arxiv.org/abs/2401.0001 (paper link)"),
    "https://arxiv.org/abs/2401.0001"
  );
  assert.equal(GomLinkUtils.extractUrlFromLine("Dòng này không chứa liên kết"), "");
  assert.equal(GomLinkUtils.extractUrlFromLine(null), "");
});

test("formatMarkdownLine should produce standard list item format", () => {
  const line = GomLinkUtils.formatMarkdownLine("Tạp chí Nature", "https://nature.com");
  assert.equal(line, "- Tạp chí Nature | https://nature.com\n");
});

test("detectPlatform identifies TikTok video and photo formats", () => {
  const videoUrl = "https://www.tiktok.com/@creative_coder/video/7123456789012345678";
  const videoInfo = GomLinkUtils.detectPlatform(videoUrl);
  assert.equal(videoInfo.platform, "TikTok");
  assert.equal(videoInfo.icon, "🎵");
  assert.equal(videoInfo.displayTitle, "@creative_coder • Video #5678");

  const photoUrl = "https://www.tiktok.com/@photographer/photo/7987654321098765432";
  const photoInfo = GomLinkUtils.detectPlatform(photoUrl);
  assert.equal(photoInfo.displayTitle, "@photographer • Ảnh trượt #5432");
});

test("detectPlatform identifies GitHub repositories", () => {
  const ghUrl = "https://github.com/torvalds/linux";
  const ghInfo = GomLinkUtils.detectPlatform(ghUrl, "Linux Kernel");
  assert.equal(ghInfo.platform, "GitHub");
  assert.equal(ghInfo.icon, "🐙");
  assert.equal(ghInfo.shortUrl, "torvalds/linux");
});

test("detectPlatform identifies YouTube videos", () => {
  const ytUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
  const ytInfo = GomLinkUtils.detectPlatform(ytUrl, "Never Gonna Give You Up - YouTube");
  assert.equal(ytInfo.platform, "YouTube");
  assert.equal(ytInfo.icon, "▶️");
  assert.equal(ytInfo.displayTitle, "Never Gonna Give You Up");
});

test("detectPlatform identifies Facebook and X/Twitter", () => {
  const fb = GomLinkUtils.detectPlatform("https://facebook.com/groups/ai");
  assert.equal(fb.platform, "Facebook");
  assert.equal(fb.icon, "📘");

  const x = GomLinkUtils.detectPlatform("https://x.com/karpathy/status/123");
  assert.equal(x.platform, "X");
  assert.equal(x.icon, "𝕏");
});

test("parseLineItem produces complete card metadata object", () => {
  const rawLine = "- Kho code PyTorch | https://github.com/pytorch/pytorch";
  const item = GomLinkUtils.parseLineItem(rawLine, 3);
  assert.equal(item.index, 3);
  assert.equal(item.platform, "GitHub");
  assert.equal(item.shortUrl, "pytorch/pytorch");
  assert.equal(item.url, "https://github.com/pytorch/pytorch");
  assert.equal(item.title, "Kho code PyTorch");
});

test("filterValidLines and countValidLines ignore headers and quotes", () => {
  const markdown = `
# Tiêu đề danh sách
> Trích dẫn hướng dẫn

- Mục 1 | https://m1.com
- Mục 2 | https://m2.com

## Nhóm phụ
> Một lưu ý khác
- Mục 3 | https://m3.com
  `;

  const valid = GomLinkUtils.filterValidLines(markdown);
  assert.equal(valid.length, 3);
  assert.equal(GomLinkUtils.countValidLines(markdown), 3);
});

test("extractAllUrls retrieves only valid URLs from text", () => {
  const markdown = `
- Link A | https://site-a.com
- Link B | https://site-b.org/docs
Dòng này không có URL
- Link C | https://site-c.vn
  `;
  const urls = GomLinkUtils.extractAllUrls(markdown);
  assert.deepEqual(urls, [
    "https://site-a.com",
    "https://site-b.org/docs",
    "https://site-c.vn",
  ]);
});
