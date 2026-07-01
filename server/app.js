// server/app.js
// What changed: Added EJS view engine config, public static folder,
// and page routes. Everything else is identical to what was built in Step 2.
// How it connects: EJS lives alongside the REST API in the same Express app.
// Page routes render views. API routes return JSON. They never conflict
// because page routes use plain paths (/dashboard) and API routes all
// start with /api/.

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");

const errorHandler = require("./middleware/errorHandler");
const notFound = require("./middleware/notFound");

const app = express();

// ── Security middleware ──────────────────────────────────────────────────────
app.use(helmet({
  // Relax CSP so EJS pages can run inline scripts and load local assets.
  // In production, tighten this to a proper nonce-based policy.
  contentSecurityPolicy: false,
}));

app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? process.env.CLIENT_URL
        : "http://localhost:5000",
    credentials: true,
  })
);

// ── Logging ──────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// ── Body parsers ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ── EJS view engine ───────────────────────────────────────────────────────────
// Why: Tells Express to use EJS for res.render() calls.
// "views" points to the folder where .ejs files live.
// "view engine" means we can call res.render("dashboard/dashboard")
// without writing the .ejs extension every time.
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// ── Static assets (CSS, JS, images served from public/) ──────────────────────
// Why: Every EJS page links to /css/variables.css, /js/api.js etc.
// Express serves these files directly from the public/ folder.
// The path /css/variables.css maps to server/public/css/variables.css.
app.use(express.static(path.join(__dirname, "public")));

// ── Serve uploaded resumes publicly ─────────────────────────────────────────
// Why: The PDF viewer in the candidate detail page needs a public URL
// to stream the file. This makes /uploads/filename.pdf accessible.
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ── Health check ─────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "AI Resume Screening API is running",
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// ── Page routes (render EJS views) ───────────────────────────────────────────
// Why: These are the browser-facing URLs. Each one just calls res.render().
// No business logic here — data loading happens client-side via fetch(/api/*).
app.use("/", require("./routes/pageRoutes"));

// ── REST API routes (unchanged from Steps 3-9) ───────────────────────────────
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/resume", require("./routes/resumeRoutes"));
app.use("/api/job", require("./routes/jobRoutes"));
app.use("/api/match", require("./routes/matchRoutes"));
app.use("/api/questions", require("./routes/questionRoutes"));
app.use("/api/dashboard", require("./routes/dashboardRoutes"));

// ── Error handling ────────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

module.exports = app;