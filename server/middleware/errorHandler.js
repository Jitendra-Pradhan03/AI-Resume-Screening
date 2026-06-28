// server/middleware/errorHandler.js
// Why this file exists: Without this, unhandled errors crash the server or
// send ugly HTML error pages to the client.
// How it connects: Registered as the LAST middleware in app.js. Express
// identifies it as an error handler by its 4-parameter signature (err, req, res, next).
// Key concept: Express error middleware must have exactly 4 parameters.

const errorHandler = (err, req, res, next) => {
  // Log the full error in development for debugging
  if (process.env.NODE_ENV === "development") {
    console.error("Error:", err.stack);
  }

  // Default to 500 if no status code was set
  let statusCode = err.statusCode || res.statusCode || 500;
  let message = err.message || "Internal Server Error";

  // Mongoose bad ObjectId (e.g. /api/candidate/not-a-valid-id)
  if (err.name === "CastError") {
    statusCode = 400;
    message = "Invalid ID format";
  }

  // Mongoose duplicate key (e.g. registering with an existing email)
  if (err.code === 11000) {
    statusCode = 400;
    const field = Object.keys(err.keyValue)[0];
    message = `${field} already exists`;
  }

  // Mongoose validation error (e.g. missing required field)
  if (err.name === "ValidationError") {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join(", ");
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid token";
  }

  if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Token expired, please login again";
  }

  // Multer errors
  if (err.code === "LIMIT_FILE_SIZE") {
    statusCode = 400;
    message = "File size too large. Maximum allowed size is 5MB";
  }

  res.status(statusCode).json({
    success: false,
    message,
    // Only show stack trace in development
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};

module.exports = errorHandler;