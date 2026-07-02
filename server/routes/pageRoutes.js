// server/routes/pageRoutes.js
// Why this file exists: Separates page-rendering routes from API routes.
// Every route here responds with an HTML page (rendered by EJS).
// Data for each page is loaded client-side via fetch() calls to /api/*.
// How it connects: Mounted at "/" in app.js, before all /api routes.
// The protect middleware is NOT used here — authentication is enforced
// client-side by checking localStorage for a JWT token. If the token is
// missing the page's JS immediately redirects to /login.

const express = require("express");
const router = express.Router();

// ── Public pages (no auth required) ─────────────────────────────────────────
// Root redirect — sends visitors straight to login
router.get("/", (req, res) => {
  res.redirect("/login");
});

router.get("/login", (req, res) => {
  // Pass a title variable — EJS uses it in <title> via <%- title %>
  res.render("auth/login", { title: "Sign In" });
});

router.get("/register", (req, res) => {
  res.render("auth/register", { title: "Create Account" });
});

// ── Protected pages (auth enforced client-side) ───────────────────────────────
router.get("/dashboard", (req, res) => {
  res.render("dashboard/dashboard.ejs", { title: "Dashboard" });
});

router.get("/upload", (req, res) => {
  res.render("dashboard/upload", { title: "Upload Resume" });
});

router.get("/candidate/:id", (req, res) => {
  // Pass the candidate ID to EJS so it's available as a JS variable
  // on the page without needing to parse the URL client-side.
  res.render("dashboard/candidate", {
    title: "Candidate Detail",
    candidateId: req.params.id,
  });
});

router.get("/rankings/:jobId", (req, res) => {
  res.render("dashboard/rankings", {
    title: "Rankings",
    jobId: req.params.jobId,
  });
});

router.get("/jobs", (req, res) => {
  res.render("dashboard/jobs", { title: "Job Descriptions" });
});
router.get("/candidates", (req, res) => {
  res.render("dashboard/candidates", { title: "All Candidates" });
});
module.exports = router;