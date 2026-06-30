// server/routes/questionRoutes.js
// Maps question endpoints to controllers. All protected.

const express = require("express");
const router = express.Router();
const protect = require("../middleware/protect");
const {
  generateQuestions,
  getQuestions,
  clearQuestions,
} = require("../controllers/questionController");

router.use(protect);

router.post("/generate", generateQuestions);
router.get("/:candidateId", getQuestions);
router.delete("/:candidateId", clearQuestions);

module.exports = router;