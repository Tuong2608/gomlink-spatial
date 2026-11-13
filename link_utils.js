/**
 * @file link_utils.js
 * @description GomLink Spatial - Reusable Pure Utilities for Link Processing,
 * Platform Detection, Sanitization, and Markdown Formatting.
 * Compatible with Node.js, Manifest V3 Service Workers, and Browser Contexts.
 */

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else if (typeof define === "function" && define.amd) {
    define([], factory);
  } else {
    root.GomLinkUtils = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const URL_REGEX = /https?:\/\/[^\s|]+/;

  /**
   * Check if a URL belongs to browser internal system pages
   * @param {string} url
   * @returns {boolean}
   */
  function isSystemUrl(url) {
    if (!url || typeof url !== "string") return true;
    const trimmed = url.trim().toLowerCase();
    return (
      trimmed === "" ||
      trimmed.startsWith("chrome://") ||
      trimmed.startsWith("chrome-extension://") ||
      trimmed.startsWith("edge://") ||
      trimmed.startsWith("about:") ||
      trimmed.startsWith("view-source:")
    );
  }

  /**
   * Sanitize a title string by stripping linebreaks, excessive spaces, and default fallbacks
   * @param {string} [rawTitle]
   * @returns {string}
   */
  function sanitizeTitle(rawTitle) {
    if (!rawTitle || typeof rawTitle !== "string") {
      return "Không tiêu đề";
    }
    const cleaned = rawTitle.replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();
    return cleaned.length > 0 ? cleaned : "Không tiêu đề";
  }

  /**
   * Extract the first valid HTTP/HTTPS URL from a line of text
   * @param {string} [line]
   * @returns {string}
   */
  function extractUrlFromLine(line) {
    if (!line || typeof line !== "string") return "";
    const match = line.match(URL_REGEX);
    return match ? match[0].trim() : "";
  }

  /**
   * Format a markdown list item: "- Title | URL\n"
   * @param {string} title
   * @param {string} url
   * @returns {string}
   */
  function formatMarkdownLine(title, url) {
    const cleanTitle = sanitizeTitle(title);
    const cleanUrl = (url || "").trim();
    return `- ${cleanTitle} | ${cleanUrl}\n`;
  }

  /**
   * Detect platform metadata (name, icon, shortUrl, title formatting) from URL
   * @param {string} url
   * @param {string} [rawTitle]
   * @returns {{ platform: string, icon: string, shortUrl: string, displayTitle: string }}
   */
  function detectPlatform(url, rawTitle = "") {
    const cleanUrl = (url || "").trim();
    let platform = "Web";
    let icon = "🌐";
    let shortUrl = cleanUrl.replace(/^https?:\/\/(www\.)?/, "");
    let displayTitle = sanitizeTitle(rawTitle);

    if (cleanUrl.includes("tiktok.com")) {
      platform = "TikTok";
      icon = "🎵";
      const userMatch = cleanUrl.match(/tiktok\.com\/(@[^/]+)\/(video|photo)\/(\d+)/);
      if (userMatch) {
        const handle = userMatch[1];
        const kind = userMatch[2] === "photo" ? "Ảnh trượt" : "Video";
        const idTail = userMatch[3].slice(-4);
        if (
          !rawTitle ||
          rawTitle === "Không tiêu đề" ||
          rawTitle.includes("(@") ||
          rawTitle === "TikTok"
        ) {
          displayTitle = `${handle} • ${kind} #${idTail}`;
        } else {
          displayTitle = displayTitle.replace(/\s*\|\s*TikTok$/i, "").trim();
        }
        shortUrl = `${handle}/${userMatch[2]}/${userMatch[3]}`;
      }
    } else if (cleanUrl.includes("github.com")) {
      platform = "GitHub";
      icon = "🐙";
      const repoMatch = cleanUrl.match(/github\.com\/([^/]+\/[^/?#]+)/);
      if (repoMatch) {
        shortUrl = repoMatch[1];
      }
    } else if (cleanUrl.includes("youtube.com") || cleanUrl.includes("youtu.be")) {
      platform = "YouTube";
      icon = "▶️";
      displayTitle = displayTitle.replace(/\s*-\s*YouTube$/i, "").trim();
    } else if (cleanUrl.includes("facebook.com") || cleanUrl.includes("fb.watch")) {
      platform = "Facebook";
      icon = "📘";
    } else if (cleanUrl.includes("x.com") || cleanUrl.includes("twitter.com")) {
      platform = "X";
      icon = "𝕏";
    }

    return { platform, icon, shortUrl, displayTitle };
  }

  /**
   * Parse a single markdown line into a structured Card item
   * @param {string} rawLine
   * @param {number} index
   * @returns {{ index: number, rawLine: string, title: string, url: string, shortUrl: string, platform: string, icon: string }}
   */
  function parseLineItem(rawLine, index = 0) {
    const line = (rawLine || "").trim();
    const url = extractUrlFromLine(line);

    let titleCandidate = line
      .replace(/^-+\s*/, "")
      .replace(url, "")
      .replace(/\|\s*$/, "")
      .trim();

    const info = detectPlatform(url, titleCandidate || "Link đã lưu");

    return {
      index,
      rawLine: line,
      title: info.displayTitle || "Link đã lưu",
      url,
      shortUrl: info.shortUrl,
      platform: info.platform,
      icon: info.icon,
    };
  }

  /**
   * Filter lines excluding markdown headers (#), quotes (>), and empty lines
   * @param {string} [text]
   * @returns {string[]}
   */
  function filterValidLines(text) {
    if (!text || typeof text !== "string") return [];
    return text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith("#") && !l.startsWith(">"));
  }

  /**
   * Count total non-empty valid link lines in text
   * @param {string} [text]
   * @returns {number}
   */
  function countValidLines(text) {
    return filterValidLines(text).length;
  }

  /**
   * Extract all valid URLs from multiline text
   * @param {string} [text]
   * @returns {string[]}
   */
  function extractAllUrls(text) {
    if (!text || typeof text !== "string") return [];
    return text
      .split("\n")
      .map((line) => extractUrlFromLine(line))
      .filter((url) => url.length > 0);
  }

  return {
    isSystemUrl,
    sanitizeTitle,
    extractUrlFromLine,
    formatMarkdownLine,
    detectPlatform,
    parseLineItem,
    filterValidLines,
    countValidLines,
    extractAllUrls,
  };
});
