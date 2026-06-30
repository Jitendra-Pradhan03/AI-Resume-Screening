// server/routes/dashboardRoutes.js
// Maps dashboard endpoints to controllers. All protected.

const express = require("express");
const router = express.Router();
const protect = require("../middleware/protect");
const { getDashboard, searchCandidates } = require("../controllers/dashboardController");

router.use(protect);

router.get("/", getDashboard);
router.get("/search", searchCandidates);

module.exports = router;