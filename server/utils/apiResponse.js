// server/utils/apiResponse.js
// Why this file exists: Without this, different controllers might send
// different shaped JSON (some with "data", some with "result", etc.).
// This enforces a consistent response format across the entire API.
// How it connects: Imported in every controller.

const sendSuccess = (res, statusCode = 200, message = "Success", data = {}) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

const sendError = (res, statusCode = 500, message = "Error", errors = null) => {
  return res.status(statusCode).json({
    success: false,
    message,
    ...(errors && { errors }),
  });
};

module.exports = { sendSuccess, sendError };