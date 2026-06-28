// server/utils/fileHelper.js
// Why this file exists: Keeps file-related helper functions reusable
// and out of controllers.
// How it connects: Imported wherever we need to format file sizes,
// build file URLs, or check file existence.

const fs = require("fs");
const path = require("path");

// Convert bytes to human-readable string: 1048576 → "1.00 MB"
const formatFileSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

// Build the public URL for an uploaded file
const buildFileUrl = (req, storedFileName) => {
  return `${req.protocol}://${req.get("host")}/uploads/${storedFileName}`;
};

// Safely delete a file — won't throw if file doesn't exist
const safeDeleteFile = (filePath) => {
  const absolute = path.resolve(filePath);
  if (fs.existsSync(absolute)) {
    fs.unlinkSync(absolute);
    return true;
  }
  return false;
};

// Check if a file path is a valid PDF by reading its magic bytes
const isPdfFile = (filePath) => {
  try {
    const buffer = Buffer.alloc(4);
    const fd = fs.openSync(filePath, "r");
    fs.readSync(fd, buffer, 0, 4, 0);
    fs.closeSync(fd);
    // PDF magic bytes: %PDF
    return buffer.toString("ascii", 0, 4) === "%PDF";
  } catch {
    return false;
  }
};

module.exports = { formatFileSize, buildFileUrl, safeDeleteFile, isPdfFile };