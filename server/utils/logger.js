// server/utils/logger.js
// Why this file exists: Centralizes logging on the Node side.
// Using a dedicated logger means we can later switch to Winston or Pino
// without changing every file that logs messages.

const get_logger = (module) => ({
  info: (msg) => console.log(`[INFO] [${module}] ${msg}`),
  error: (msg) => console.error(`[ERROR] [${module}] ${msg}`),
  debug: (msg) => {
    if (process.env.NODE_ENV === "development") {
      console.log(`[DEBUG] [${module}] ${msg}`);
    }
  },
  warn: (msg) => console.warn(`[WARN] [${module}] ${msg}`),
});

module.exports = { get_logger };