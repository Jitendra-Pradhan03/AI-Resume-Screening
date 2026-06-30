// server/controllers/matchController.js
// Why this file exists: Handles POST /api/match — takes a list of candidate
// IDs and a job description ID, runs the full AI pipeline on each, saves
// the scores, and returns ranked results.
// How it connects: Called by matchRoutes. Uses aiService to spawn Python
// and Candidate/JobDescription models to read/write MongoDB.
// Key concept: We process candidates sequentially (not in parallel) to
// avoid overloading the machine with multiple Python processes at once.

const Candidate = require("../models/Candidate");
const JobDescription = require("../models/JobDescription");
const { runFullPipeline, matchResume } = require("../services/aiService");
const { sendSuccess, sendError } = require("../utils/apiResponse");

// ── Match a single resume against a job description ───────────────────────────
// POST /api/match/single
const matchSingleResume = async (req, res, next) => {
  try {
    const { candidateId, jobDescriptionId } = req.body;

    if (!candidateId || !jobDescriptionId) {
      return sendError(res, 400, "candidateId and jobDescriptionId are required");
    }

    // Fetch both documents — verify ownership
    const [candidate, jobDesc] = await Promise.all([
      Candidate.findOne({ _id: candidateId, recruiter: req.user._id }),
      JobDescription.findOne({ _id: jobDescriptionId, recruiter: req.user._id }),
    ]);

    if (!candidate) return sendError(res, 404, "Candidate not found");
    if (!jobDesc) return sendError(res, 404, "Job description not found");

    // Run AI matching
    await Candidate.findByIdAndUpdate(candidateId, { status: "processing" });

    let aiResult;

    if (candidate.status === "analyzed" && candidate.parsedData?.rawText) {
      // Resume already parsed — just run matching
      aiResult = await matchResume(
        candidate.filePath,
        jobDesc.description,
        candidate.parsedData
      );
    } else {
      // Run full pipeline (parse + match)
      aiResult = await runFullPipeline(candidate.filePath, jobDesc.description);
    }

    if (!aiResult.success) {
      await Candidate.findByIdAndUpdate(candidateId, {
        status: "error",
        errorMessage: aiResult.error,
      });
      return sendError(res, 500, `AI matching failed: ${aiResult.error}`);
    }

    // Save results to MongoDB
    const updateData = {
      status: "matched",
      jobDescription: jobDescriptionId,
      matchScore: aiResult.data.matchScore || aiResult.data,
    };

    // If full pipeline ran, also save parsed data
    if (aiResult.data.parsedResume) {
      updateData.parsedData = aiResult.data.parsedResume;
    }
    if (aiResult.data.interviewQuestions) {
      updateData.interviewQuestions = aiResult.data.interviewQuestions;
    }

    // Save question breakdown if returned
    if (aiResult.data.questionBreakdown) {
      updateData.questionsByCategory = aiResult.data.questionBreakdown;
    }
    const updated = await Candidate.findByIdAndUpdate(
      candidateId,
      updateData,
      { new: true }
    );

    return sendSuccess(res, 200, "Resume matched successfully", {
      candidate: {
        id: updated._id,
        name: updated.parsedData?.name || updated.originalFileName,
        matchScore: updated.matchScore,
        status: updated.status,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ── Match multiple resumes and rank them ──────────────────────────────────────
// POST /api/match/batch
// Processes candidates one at a time and returns them sorted by score
const matchBatch = async (req, res, next) => {
  try {
    const { candidateIds, jobDescriptionId } = req.body;

    if (!candidateIds?.length || !jobDescriptionId) {
      return sendError(res, 400, "candidateIds array and jobDescriptionId are required");
    }

    if (candidateIds.length > 20) {
      return sendError(res, 400, "Maximum 20 candidates per batch");
    }

    const jobDesc = await JobDescription.findOne({
      _id: jobDescriptionId,
      recruiter: req.user._id,
    });

    if (!jobDesc) return sendError(res, 404, "Job description not found");

    const results = [];
    const errors = [];

    // Process sequentially to avoid spawning too many Python processes
    for (const candidateId of candidateIds) {
      try {
        const candidate = await Candidate.findOne({
          _id: candidateId,
          recruiter: req.user._id,
        });

        if (!candidate) {
          errors.push({ candidateId, error: "Not found" });
          continue;
        }

        await Candidate.findByIdAndUpdate(candidateId, { status: "processing" });

        let aiResult;
        if (candidate.parsedData?.rawText) {
          aiResult = await matchResume(
            candidate.filePath,
            jobDesc.description,
            candidate.parsedData
          );
        } else {
          aiResult = await runFullPipeline(candidate.filePath, jobDesc.description);
        }

        if (!aiResult.success) {
          await Candidate.findByIdAndUpdate(candidateId, {
            status: "error",
            errorMessage: aiResult.error,
          });
          errors.push({ candidateId, error: aiResult.error });
          continue;
        }

        const updateData = {
          status: "matched",
          jobDescription: jobDescriptionId,
          matchScore: aiResult.data.matchScore || aiResult.data,
        };

        if (aiResult.data.parsedResume) {
          updateData.parsedData = aiResult.data.parsedResume;
        }
        if (aiResult.data.interviewQuestions) {
          updateData.interviewQuestions = aiResult.data.interviewQuestions;
        }

        if (aiResult.data.questionBreakdown) {
          updateData.questionsByCategory = aiResult.data.questionBreakdown;
        }
        const updated = await Candidate.findByIdAndUpdate(
          candidateId,
          updateData,
          { new: true }
        );

        results.push({
          id: updated._id,
          name: updated.parsedData?.name || updated.originalFileName,
          email: updated.parsedData?.email || "",
          matchScore: updated.matchScore,
          status: updated.status,
        });
      } catch (err) {
        errors.push({ candidateId, error: err.message });
      }
    }

    // Sort by weighted final score descending and assign ranks
    results.sort(
      (a, b) =>
        (b.matchScore?.weightedFinalScore || 0) -
        (a.matchScore?.weightedFinalScore || 0)
    );

    // Save rank back to each candidate document
    for (let i = 0; i < results.length; i++) {
      await Candidate.findByIdAndUpdate(results[i].id, { rank: i + 1 });
      results[i].rank = i + 1;
    }

    return sendSuccess(res, 200, "Batch matching complete", {
      jobTitle: jobDesc.title,
      totalProcessed: results.length,
      totalErrors: errors.length,
      rankedCandidates: results,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    next(error);
  }
};

// ── Get ranked candidates for a job ──────────────────────────────────────────
// GET /api/match/rankings/:jobDescriptionId
const getRankings = async (req, res, next) => {
  try {
    const { jobDescriptionId } = req.params;

    const jobDesc = await JobDescription.findOne({
      _id: jobDescriptionId,
      recruiter: req.user._id,
    });

    if (!jobDesc) return sendError(res, 404, "Job description not found");

    const candidates = await Candidate.find({
      recruiter: req.user._id,
      jobDescription: jobDescriptionId,
      status: "matched",
    })
      .select(
        "originalFileName parsedData.name parsedData.email parsedData.skills matchScore rank status createdAt"
      )
      .sort({ rank: 1 });

    return sendSuccess(res, 200, "Rankings retrieved", {
      jobTitle: jobDesc.title,
      totalCandidates: candidates.length,
      candidates,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { matchSingleResume, matchBatch, getRankings };