// server/routes/resumeRoutes.js
// Why this file exists: Maps resume-related HTTP endpoints to controllers.
// How it connects: Mounted at /api/resume in app.js. All routes are
// protected — a recruiter must be logged in to upload or view resumes.
// Key concept: upload.single("resume") is Multer middleware — it runs
// before the controller and populates req.file.

const express = require("express");
const router = express.Router();

const protect = require("../middleware/protect");
const upload = require("../config/multer");
const {
  uploadResume,
  getAllResumes,
  getResumeById,
  deleteResume,
  updateNotes,
  getResumeStats,
} = require("../controllers/resumeController");

// All routes require authentication
router.use(protect);

// Stats must come before /:id so Express doesn't treat "stats" as an ID
router.get("/stats", getResumeStats);

router.post("/upload", upload.single("resume"), uploadResume);
router.get("/", getAllResumes);
router.get("/:id", getResumeById);
router.delete("/:id", deleteResume);
router.patch("/:id/notes", updateNotes);

module.exports = router;