// server/app.js
// Why this file exists: Separating the Express app from server.js allows
// the app to be imported and tested independently without starting a real server.
// How it connects: server.js imports this, calls app.listen().
// Key concept: Middleware order matters in Express — each request flows
// through middleware top to bottom.

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");

const errorHandler = require("./middleware/errorHandler");
const notFound = require("./middleware/notFound");

const app = express();

// ── Security middleware ──────────────────────────────────────────────────────
// helmet sets secure HTTP headers (XSS protection, no sniff, etc.)
app.use(helmet());

// cors allows requests from the browser (different port in development)
app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? process.env.CLIENT_URL
        : "http://localhost:3000",
    credentials: true,
  })
);

// ── Logging ──────────────────────────────────────────────────────────────────
// morgan logs: GET /api/auth/login 200 45ms
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// ── Body parsers ─────────────────────────────────────────────────────────────
// Parses incoming JSON bodies (needed for POST/PUT requests)
app.use(express.json({ limit: "10mb" }));
// Parses URL-encoded form data
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ── Static files ─────────────────────────────────────────────────────────────
// Serve uploaded files at /uploads/filename.pdf
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ── Health check route ───────────────────────────────────────────────────────
// Useful for checking if the server is running without hitting a real route
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "AI Resume Screening API is running",
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// ── API Routes ───────────────────────────────────────────────────────────────
// Routes will be added here as we build each module
// app.use("/api/auth", require("./routes/authRoutes"));
// app.use("/api/resume", require("./routes/resumeRoutes"));
// app.use("/api/job", require("./routes/jobRoutes"));
// app.use("/api/match", require("./routes/matchRoutes"));
// app.use("/api/dashboard", require("./routes/dashboardRoutes"));

// ── Error handling (must be last) ────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

module.exports = app;