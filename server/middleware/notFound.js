// server/middleware/notFound.js
// Why this file exists: Without this, Express sends a default HTML 404 page.
// We want consistent JSON responses across the entire API.
// How it connects: Registered just before errorHandler in app.js.

const notFound = (req, res, next) => {
  const error = new Error(`Route not found: ${req.originalUrl}`);
  error.statusCode = 404;
  next(error); // Pass to errorHandler
};

module.exports = notFound;