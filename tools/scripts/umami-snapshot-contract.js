"use strict";

const { inflateSync } = require("node:zlib");
const { createHash } = require("node:crypto");

const START = "<!-- UMAMI_ANALYTICS_START -->";
const END = "<!-- UMAMI_ANALYTICS_END -->";
const IMAGE = "assets/analytics/umami-dashboard.png";
const PREFIX = "assets/analytics/history/";
// Existing valid image: 1278 x 521, 13,254 bytes. Bounds allow chart growth,
// but exclude full-page captures, image bombs, and metadata-bearing payloads.
const LIMITS = Object.freeze({ minWidth: 600, maxWidth: 2000, minHeight: 250, maxHeight: 1000, maxBytes: 2 * 1024 * 1024 });
const STATES = Object.freeze(["UPDATED", "UNCHANGED", "INVALID_DASHBOARD", "FETCH_FAILURE", "SCREENSHOT_FAILURE", "VALIDATION_FAILURE"]);
class SnapshotError extends Error {
  constructor(state = "VALIDATION_FAILURE") { super(state); this.state = state; }
}
function requireValid(condition) { if (!condition) throw new SnapshotError(); }
function validDate(value) {
  const date = new Date(`${value}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function snapshotDate(value) {
  const date = new Date(value);
  requireValid(Number.isFinite(date.getTime()));
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
function splitReadme(text) {
  requireValid(typeof text === "string" && text.split(START).length === 2 && text.split(END).length === 2);
  const start = text.indexOf(START), end = text.indexOf(END) + END.length;
  requireValid(start < text.indexOf(END));
  return { before: text.slice(0, start), block: text.slice(start, end), after: text.slice(end) };
}
function readmeBlock(value) {
  snapshotDate(value);
  const updated = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Taipei", dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  return `${START}\n## Website Analytics\n\nDaily Umami analytics snapshot for Jam Tracks Hub.\n\nLast updated: ${updated}\n\n<p align="center">\n  <img src="${IMAGE}" alt="Umami analytics dashboard" width="100%" />\n</p>\n${END}`;
}
function validateReadme(before, after) {
  const a = splitReadme(before), b = splitReadme(after);
  requireValid(a.before === b.before && a.after === b.after);
  // The only variable in the generated block is the formatted timestamp.
  const time = b.block.match(/\nLast updated: ([^\n]+)\n/);
  requireValid(time && /^[A-Z][a-z]{2} \d{1,2}, \d{4}, \d{1,2}:\d{2} [AP]M$/.test(time[1]));
  requireValid(b.block.replace(time[1], "TIME") === readmeBlock("2026-09-06T00:00:00Z").replace("Sep 6, 2026, 8:00 AM", "TIME"));
}
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function paeth(a, b, c) {
  const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}
function decodePng(bytes) {
  requireValid(Buffer.isBuffer(bytes) && bytes.length >= 45 && bytes.length <= LIMITS.maxBytes);
  requireValid(bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])));
  let offset = 8, width, height, channels, ended = false, idatEnded = false;
  const data = [];
  while (offset < bytes.length) {
    requireValid(offset + 12 <= bytes.length);
    const size = bytes.readUInt32BE(offset), end = offset + 12 + size;
    requireValid(end <= bytes.length);
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    const chunk = bytes.subarray(offset + 8, end - 4);
    requireValid(crc32(bytes.subarray(offset + 4, end - 4)) === bytes.readUInt32BE(end - 4));
    if (type === "IHDR") {
      requireValid(offset === 8 && size === 13 && !width);
      width = chunk.readUInt32BE(0); height = chunk.readUInt32BE(4);
      requireValid(width >= LIMITS.minWidth && width <= LIMITS.maxWidth && height >= LIMITS.minHeight && height <= LIMITS.maxHeight);
      requireValid(chunk[8] === 8 && [2,6].includes(chunk[9]) && chunk[10] === 0 && chunk[11] === 0 && chunk[12] === 0);
      channels = chunk[9] === 2 ? 3 : 4;
    } else if (type === "IDAT") {
      requireValid(width && !idatEnded && size > 0); data.push(chunk);
    } else if (type === "IEND") {
      requireValid(size === 0 && data.length > 0 && end === bytes.length); ended = true;
    } else {
      // Chromium may include these fixed color-space chunks. No text, EXIF,
      // embedded profiles, URLs or arbitrary ancillary chunks are permitted.
      requireValid(width && data.length === 0 && ((type === "sRGB" && size === 1 && chunk[0] <= 3) || (type === "gAMA" && size === 4)));
    }
    if (data.length && type !== "IDAT") idatEnded = true;
    offset = end;
  }
  requireValid(ended);
  const stride = width * channels, expected = (stride + 1) * height;
  let raw;
  try { raw = inflateSync(Buffer.concat(data), { maxOutputLength: expected }); } catch { throw new SnapshotError(); }
  requireValid(raw.length === expected);
  const pixels = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]; requireValid(filter <= 4);
    for (let x = 0; x < stride; x++) {
      const i = y * stride + x, a = x >= channels ? pixels[i - channels] : 0;
      const b = y ? pixels[i - stride] : 0, c = y && x >= channels ? pixels[i - stride - channels] : 0;
      const predict = [0, a, b, Math.floor((a + b) / 2), paeth(a,b,c)][filter];
      pixels[i] = (raw[y * (stride + 1) + 1 + x] + predict) & 255;
    }
  }
  return { width, height, channels, digest: createHash("sha256").update(`${width}:${height}:${channels}:`).update(pixels).digest("hex") };
}
function validateFiles(files) {
  requireValid(Array.isArray(files) && files.length <= 34 && new Set(files.map(f => f.path)).size === files.length);
  for (const f of files) {
    requireValid(["added", "modified"].includes(f.status) && (!f.mode || f.mode === "100644"));
    const history = f.path.startsWith(PREFIX) && f.path.endsWith(".png") ? f.path.slice(PREFIX.length, -4) : "";
    requireValid(f.path === "README.md" || f.path === IMAGE || validDate(history));
    if (f.path !== "README.md") decodePng(f.bytes);
  }
}
function buildSnapshot({ readme, previousImage, image, now }) {
  const decoded = decodePng(image), day = snapshotDate(now);
  splitReadme(readme);
  if (previousImage && decodePng(previousImage).digest === decoded.digest) return { state: "UNCHANGED", day, files: [] };
  const sections = splitReadme(readme);
  const next = sections.before + readmeBlock(now) + sections.after;
  validateReadme(readme, next);
  const files = [
    { path: "README.md", status: "modified", bytes: Buffer.from(next) },
    { path: IMAGE, status: "modified", bytes: image },
    { path: `${PREFIX}${day}.png`, status: "added", bytes: image }
  ];
  validateFiles(files);
  return { state: "UPDATED", day, files };
}
function safeFailure(error) { return error instanceof SnapshotError && STATES.includes(error.state) ? error.state : "VALIDATION_FAILURE"; }
module.exports = { START, END, IMAGE, PREFIX, LIMITS, STATES, SnapshotError, requireValid, validDate, snapshotDate, splitReadme, readmeBlock, validateReadme, decodePng, validateFiles, buildSnapshot, safeFailure, crc32 };
