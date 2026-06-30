// server/routes/matchRoutes.js
// Maps matching endpoints to controllers.
// All routes are protected — only authenticated recruiters can trigger matching.

const express = require("express");
const router = express.Router();
const protect = require("../middleware/protect");
const {
  matchSingleResume,
  matchBatch,
  getRankings,
} = require("../controllers/matchController");

router.use(protect);

router.post("/single", matchSingleResume);
router.post("/batch", matchBatch);
router.get("/rankings/:jobDescriptionId", getRankings);

module.exports = router;