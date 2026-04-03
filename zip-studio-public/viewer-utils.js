const MAX_TEXT_PREVIEW_BYTES = 512000;
const HEX_COLUMNS = 16;
const PDF_PREVIEW_SCALE = 1.35;
const textDecoder = new TextDecoder();
const textEncoder = new TextEncoder();

function inferMime(fileName, bytes) {
  const lower = fileName.toLowerCase();
  if (looksLikePdf(bytes, fileName, "")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".webm")) return "video/webm";
  if (lower.endsWith(".ogv") || lower.endsWith(".ogg")) return "video/ogg";
  return "application/octet-stream";
}

function resolveStandaloneMode(fileName, mime, bytes) {
  if (looksLikePdf(bytes, fileName, mime)) return "pdf";
  if (looksLikeImage(fileName, mime)) return "image";
  if (looksLikeVideo(fileName, mime)) return "video";
  if (isProbablyText(bytes) && bytes.length <= MAX_TEXT_PREVIEW_BYTES) return "text";
  return "hex";
}

function looksLikeZip(bytes, fileName) {
  return (
    fileName.toLowerCase().endsWith(".zip") ||
    (bytes.length >= 4 &&
      bytes[0] === 0x50 &&
      bytes[1] === 0x4b &&
      (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07) &&
      (bytes[3] === 0x04 || bytes[3] === 0x06 || bytes[3] === 0x08))
  );
}

function looksLikePdf(bytes, fileName, mime) {
  return (
    mime === "application/pdf" ||
    fileName.toLowerCase().endsWith(".pdf") ||
    (bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46)
  );
}

function looksLikeImage(fileName, mime) {
  return mime.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg)$/i.test(fileName);
}

function looksLikeVideo(fileName, mime) {
  return mime.startsWith("video/") || /\.(mp4|webm|ogv|ogg)$/i.test(fileName);
}

function isProbablyText(bytes) {
  if (bytes.length === 0) return true;
  let suspicious = 0;
  const sampleLength = Math.min(bytes.length, 1024);
  for (let index = 0; index < sampleLength; index += 1) {
    const value = bytes[index];
    if (value === 0) return false;
    const printable =
      value === 9 || value === 10 || value === 13 || (value >= 32 && value <= 126) || value >= 128;
    if (!printable) suspicious += 1;
  }
  return suspicious / sampleLength < 0.03;
}

function formatHex(bytes) {
  const lines = [];
  for (let offset = 0; offset < bytes.length; offset += HEX_COLUMNS) {
    const chunk = bytes.slice(offset, offset + HEX_COLUMNS);
    lines.push(Array.from(chunk).map((value) => value.toString(16).padStart(2, "0")).join(" "));
  }
  return lines.join("\n");
}

function parseHexString(value) {
  const sanitized = value.replace(/[^0-9a-fA-F]/g, "");
  if (sanitized.length % 2 !== 0) throw new Error("Hex mode requires pairs of hexadecimal characters.");
  const bytes = new Uint8Array(sanitized.length / 2);
  for (let index = 0; index < sanitized.length; index += 2) {
    bytes[index / 2] = Number.parseInt(sanitized.slice(index, index + 2), 16);
  }
  return bytes;
}

function formatBytes(size) {
  if (size < 1024) return size + " bytes";
  if (size < 1024 * 1024) return (size / 1024).toFixed(1) + " KB";
  return (size / (1024 * 1024)).toFixed(1) + " MB";
}

function formatDuration(seconds) {
  const total = Math.round(seconds);
  return Math.floor(total / 60) + ":" + String(total % 60).padStart(2, "0");
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

async function loadImageMetadata(objectUrl) {
  return await new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error("This image could not be previewed in the browser."));
    image.src = objectUrl;
  });
}

async function loadVideoMetadata(objectUrl, mime) {
  return await new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () =>
      resolve({
        duration: video.duration,
        durationLabel: Number.isFinite(video.duration) ? formatDuration(video.duration) : "Unknown",
        mime
      });
    video.onerror = () => resolve({ duration: null, durationLabel: "Preview depends on browser codec support", mime });
    video.src = objectUrl;
  });
}

async function parseZip(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocdOffset = findEndOfCentralDirectory(view);
  const totalEntries = view.getUint16(eocdOffset + 10, true);
  const centralDirectoryOffset = view.getUint32(eocdOffset + 16, true);
  let offset = centralDirectoryOffset;
  const entries = [];
  for (let index = 0; index < totalEntries; index += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) throw new Error("The zip archive looks malformed.");
    const compressionMethod = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const fileNameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);
    const fileNameBytes = bytes.slice(offset + 46, offset + 46 + fileNameLength);
    const path = textDecoder.decode(fileNameBytes);
    const localNameLength = view.getUint16(localHeaderOffset + 26, true);
    const localExtraLength = view.getUint16(localHeaderOffset + 28, true);
    const dataOffset = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const compressedBytes = bytes.slice(dataOffset, dataOffset + compressedSize);
    const uncompressedBytes = await decompressZipEntry(compressionMethod, compressedBytes);
    const textLike = isProbablyText(uncompressedBytes);
    entries.push({
      path,
      name: path.split("/").filter(Boolean).slice(-1)[0] || path,
      directory: path.endsWith("/"),
      editable: !path.endsWith("/") && textLike && uncompressedBytes.length <= MAX_TEXT_PREVIEW_BYTES,
      text: !path.endsWith("/") && textLike && uncompressedBytes.length <= MAX_TEXT_PREVIEW_BYTES ? textDecoder.decode(uncompressedBytes) : null,
      bytes: uncompressedBytes,
      originalCompression: compressionMethod,
      dirty: false
    });
    offset += 46 + fileNameLength + extraLength + commentLength;
  }
  return entries;
}

function findEndOfCentralDirectory(view) {
  const minOffset = Math.max(0, view.byteLength - 65557);
  for (let offset = view.byteLength - 22; offset >= minOffset; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) return offset;
  }
  throw new Error("Could not find the end of central directory record in that zip file.");
}

async function decompressZipEntry(method, bytes) {
  if (method === 0) return bytes;
  if (method === 8) {
    if (typeof DecompressionStream === "undefined") throw new Error("This browser cannot open deflated zip entries yet.");
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    const arrayBuffer = await new Response(stream).arrayBuffer();
    return new Uint8Array(arrayBuffer);
  }
  throw new Error("Compression method " + method + " is not supported in this browser-based editor.");
}

function createZipArchive(entries) {
  const normalizedEntries = entries.map((entry) => ({ entry, encodedName: textEncoder.encode(entry.path) }));
  let localOffset = 0;
  let centralDirectoryLength = 0;
  normalizedEntries.forEach((item) => {
    localOffset += 30 + item.encodedName.length + item.entry.bytes.length;
    centralDirectoryLength += 46 + item.encodedName.length;
  });
  const output = new Uint8Array(localOffset + centralDirectoryLength + 22);
  const view = new DataView(output.buffer);
  const centralRecords = [];
  let writeOffset = 0;
  normalizedEntries.forEach((item) => {
    const crc = crc32(item.entry.bytes);
    view.setUint32(writeOffset, 0x04034b50, true);
    view.setUint16(writeOffset + 4, 20, true);
    view.setUint16(writeOffset + 6, 0x0800, true);
    view.setUint32(writeOffset + 14, crc >>> 0, true);
    view.setUint32(writeOffset + 18, item.entry.bytes.length, true);
    view.setUint32(writeOffset + 22, item.entry.bytes.length, true);
    view.setUint16(writeOffset + 26, item.encodedName.length, true);
    const localHeaderOffset = writeOffset;
    writeOffset += 30;
    output.set(item.encodedName, writeOffset);
    writeOffset += item.encodedName.length;
    output.set(item.entry.bytes, writeOffset);
    writeOffset += item.entry.bytes.length;
    centralRecords.push({ encodedName: item.encodedName, crc, size: item.entry.bytes.length, localHeaderOffset, directory: item.entry.directory });
  });
  const centralDirectoryOffset = writeOffset;
  centralRecords.forEach((record) => {
    view.setUint32(writeOffset, 0x02014b50, true);
    view.setUint16(writeOffset + 4, 20, true);
    view.setUint16(writeOffset + 6, 20, true);
    view.setUint16(writeOffset + 8, 0x0800, true);
    view.setUint32(writeOffset + 16, record.crc >>> 0, true);
    view.setUint32(writeOffset + 20, record.size, true);
    view.setUint32(writeOffset + 24, record.size, true);
    view.setUint16(writeOffset + 28, record.encodedName.length, true);
    view.setUint32(writeOffset + 38, record.directory ? 0x10 : 0, true);
    view.setUint32(writeOffset + 42, record.localHeaderOffset, true);
    writeOffset += 46;
    output.set(record.encodedName, writeOffset);
    writeOffset += record.encodedName.length;
  });
  const centralDirectorySize = writeOffset - centralDirectoryOffset;
  view.setUint32(writeOffset, 0x06054b50, true);
  view.setUint16(writeOffset + 8, centralRecords.length, true);
  view.setUint16(writeOffset + 10, centralRecords.length, true);
  view.setUint32(writeOffset + 12, centralDirectorySize, true);
  view.setUint32(writeOffset + 16, centralDirectoryOffset, true);
  return output;
}

function crc32(bytes) {
  let crc = -1;
  for (const currentByte of bytes) {
    crc ^= currentByte;
    for (let index = 0; index < 8; index += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ -1) >>> 0;
}

function triggerDownload(blob, fileName) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
}
