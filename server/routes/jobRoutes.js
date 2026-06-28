// server/routes/jobRoutes.js
// Why this file exists: Maps job description endpoints to controllers.
// Mounted at /api/job in app.js.

const express = require("express");
const router = express.Router();

const protect = require("../middleware/protect");
const {
  createJobDescription,
  getAllJobDescriptions,
  getJobDescriptionById,
  updateJobDescription,
  deleteJobDescription,
} = require("../controllers/jobController");

router.use(protect);

router.post("/", createJobDescription);
router.get("/", getAllJobDescriptions);
router.get("/:id", getJobDescriptionById);
router.put("/:id", updateJobDescription);
router.delete("/:id", deleteJobDescription);

module.exports = router;