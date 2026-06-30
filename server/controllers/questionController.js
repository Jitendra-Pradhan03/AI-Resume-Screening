// server/controllers/questionController.js
// Why this file exists: Lets the frontend request question regeneration
// for a specific candidate without re-running the full pipeline.
// Also handles saving questions back to MongoDB and filtering by category/difficulty.

const Candidate = require("../models/Candidate");
const { generateInterviewQuestions } = require("../services/aiService");
const { sendSuccess, sendError } = require("../utils/apiResponse");

// ── Generate questions for a candidate ───────────────────────────────────────
// POST /api/questions/generate
const generateQuestions = async (req, res, next) => {
  try {
    const { candidateId } = req.body;

    if (!candidateId) {
      return sendError(res, 400, "candidateId is required");
    }

    const candidate = await Candidate.findOne({
      _id: candidateId,
      recruiter: req.user._id,
    });

    if (!candidate) {
      return sendError(res, 404, "Candidate not found");
    }

    if (!candidate.parsedData || !candidate.parsedData.skills?.length) {
      return sendError(
        res,
        400,
        "Candidate resume must be analyzed before generating questions. Status: " + candidate.status
      );
    }

    // Call Python AI question generator
    const aiResult = await generateInterviewQuestions(
      candidate.parsedData,
      candidate.jobDescription?.description || ""
    );

    if (!aiResult.success) {
      return sendError(res, 500, `Question generation failed: ${aiResult.error}`);
    }

    // Save questions to candidate document
    const updated = await Candidate.findByIdAndUpdate(
      candidateId,
      { interviewQuestions: aiResult.data.questions },
      { new: true }
    ).select("interviewQuestions parsedData.name");

    return sendSuccess(res, 200, "Interview questions generated successfully", {
      candidateName: updated.parsedData?.name || "Unknown",
      questions: updated.interviewQuestions,
      breakdown: aiResult.data.breakdown,
      total: aiResult.data.total,
    });
  } catch (error) {
    next(error);
  }
};

// ── Get questions for a candidate ─────────────────────────────────────────────
// GET /api/questions/:candidateId
// Supports filtering by category and difficulty via query params
const getQuestions = async (req, res, next) => {
  try {
    const candidate = await Candidate.findOne({
      _id: req.params.candidateId,
      recruiter: req.user._id,
    }).select("interviewQuestions parsedData.name parsedData.skills status");

    if (!candidate) {
      return sendError(res, 404, "Candidate not found");
    }

    let questions = candidate.interviewQuestions || [];

    // Filter by category (e.g. ?category=technical)
    if (req.query.category) {
      questions = questions.filter(
        (q) => q.category === req.query.category
      );
    }

    // Filter by difficulty (e.g. ?difficulty=hard)
    if (req.query.difficulty) {
      questions = questions.filter(
        (q) => q.difficulty === req.query.difficulty
      );
    }

    // Build a summary breakdown from current questions
    const breakdown = {
      total: questions.length,
      byCategory: {},
      byDifficulty: {},
    };

    for (const q of questions) {
      breakdown.byCategory[q.category] = (breakdown.byCategory[q.category] || 0) + 1;
      breakdown.byDifficulty[q.difficulty] = (breakdown.byDifficulty[q.difficulty] || 0) + 1;
    }

    return sendSuccess(res, 200, "Questions retrieved", {
      candidateName: candidate.parsedData?.name || "Unknown",
      questions,
      breakdown,
      filters: {
        category: req.query.category || "all",
        difficulty: req.query.difficulty || "all",
      },
    });
  } catch (error) {
    next(error);
  }
};

// ── Delete all questions for a candidate (to force regeneration) ──────────────
// DELETE /api/questions/:candidateId
const clearQuestions = async (req, res, next) => {
  try {
    const candidate = await Candidate.findOneAndUpdate(
      { _id: req.params.candidateId, recruiter: req.user._id },
      { interviewQuestions: [] },
      { new: true }
    );

    if (!candidate) {
      return sendError(res, 404, "Candidate not found");
    }

    return sendSuccess(res, 200, "Questions cleared successfully", {
      candidateId: req.params.candidateId,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { generateQuestions, getQuestions, clearQuestions };