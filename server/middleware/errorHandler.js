// server/middleware/errorHandler.js

const errorHandler = (err, req, res, next) => {
  if (process.env.NODE_ENV === "development") {
    console.error("Error:", err.stack);
  }

  let statusCode = err.statusCode || res.statusCode || 500;
  let message = err.message || "Internal Server Error";

  if (err.name === "CastError") {
    statusCode = 400;
    message = "Invalid ID format";
  }

  if (err.code === 11000) {
    statusCode = 400;
    message = `${Object.keys(err.keyValue)[0]} already exists`;
  }

  if (err.name === "ValidationError") {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join(", ");
  }

  if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid token";
  }

  if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Token expired, please login again";
  }

  if (err.code === "LIMIT_FILE_SIZE") {
    statusCode = 400;
    message = "File size too large. Maximum allowed size is 5MB";
  }

  // API requests → JSON
  if (req.originalUrl.startsWith("/api")) {
    return res.status(statusCode).json({
      success: false,
      message,
      ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    });
  }

  // Browser requests → EJS page
  return res.status(statusCode).render("error", {
    title: "Error",
    status: statusCode,
    message,
  });
};

module.exports = errorHandler;