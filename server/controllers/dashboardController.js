// server/controllers/dashboardController.js
// Why this file exists: The dashboard needs data from multiple collections
// combined into one response — stats, recent activity, and top-ranked
// candidates per job. Doing this in one controller with parallel queries
// is far more efficient than the frontend making 4-5 separate API calls.
// How it connects: Called by GET /api/dashboard. Reads from Candidate
// and JobDescription models.
// Key concept: MongoDB aggregation pipelines let us group and count
// documents directly in the database rather than pulling everything
// into Node.js and looping over it.

const Candidate = require("../models/Candidate");
const JobDescription = require("../models/JobDescription");
const { sendSuccess, sendError } = require("../utils/apiResponse");

// ── Main dashboard endpoint ────────────────────────────────────────────────────
// GET /api/dashboard
const getDashboard = async (req, res, next) => {
  try {
    const recruiterId = req.user._id;

    // Run all independent queries in parallel for speed
    const [
      totalCandidates,
      totalJobDescriptions,
      statusBreakdown,
      recentUploads,
      activeJobDescriptions,
      avgScoreResult,
    ] = await Promise.all([
      // Total candidates ever uploaded by this recruiter
      Candidate.countDocuments({ recruiter: recruiterId }),

      // Total job descriptions created
      JobDescription.countDocuments({ recruiter: recruiterId, isActive: true }),

      // Count candidates grouped by status (uploaded/processing/analyzed/matched/error)
      Candidate.aggregate([
        { $match: { recruiter: recruiterId } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),

      // Last 8 uploads — for "recent activity" feed
      Candidate.find({ recruiter: recruiterId })
        .select("originalFileName status matchScore.weightedFinalScore parsedData.name createdAt")
        .populate("jobDescription", "title")
        .sort({ createdAt: -1 })
        .limit(8),

      // Active job descriptions with a candidate count per job
      JobDescription.aggregate([
        { $match: { recruiter: recruiterId, isActive: true } },
        {
          $lookup: {
            from: "candidates",
            localField: "_id",
            foreignField: "jobDescription",
            as: "candidates",
          },
        },
        {
          $project: {
            title: 1,
            company: 1,
            createdAt: 1,
            candidateCount: { $size: "$candidates" },
            matchedCount: {
              $size: {
                $filter: {
                  input: "$candidates",
                  cond: { $eq: ["$$this.status", "matched"] },
                },
              },
            },
          },
        },
        { $sort: { createdAt: -1 } },
        { $limit: 6 },
      ]),

      // Average weighted final score across all matched candidates
      Candidate.aggregate([
        {
          $match: {
            recruiter: recruiterId,
            status: "matched",
            "matchScore.weightedFinalScore": { $exists: true },
          },
        },
        {
          $group: {
            _id: null,
            avgScore: { $avg: "$matchScore.weightedFinalScore" },
          },
        },
      ]),
    ]);

    // Convert status breakdown array into a clean object
    const statusCounts = statusBreakdown.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {});

    // ── Top candidates per active job (parallel sub-queries) ───────────────
    const topCandidatesPerJob = await Promise.all(
      activeJobDescriptions.map(async (job) => {
        const topCandidates = await Candidate.find({
          recruiter: recruiterId,
          jobDescription: job._id,
          status: "matched",
        })
          .select("originalFileName parsedData.name matchScore.weightedFinalScore rank")
          .sort({ rank: 1 })
          .limit(5);

        return {
          jobId: job._id,
          jobTitle: job.title,
          company: job.company,
          totalCandidates: job.candidateCount,
          matchedCandidates: job.matchedCount,
          topCandidates: topCandidates.map((c) => ({
            id: c._id,
            name: c.parsedData?.name || c.originalFileName,
            score: c.matchScore?.weightedFinalScore || 0,
            rank: c.rank,
          })),
        };
      })
    );

    return sendSuccess(res, 200, "Dashboard data retrieved successfully", {
      summary: {
        totalCandidates,
        totalJobDescriptions,
        averageMatchScore: avgScoreResult[0]
          ? Math.round(avgScoreResult[0].avgScore * 100) / 100
          : 0,
        statusCounts: {
          uploaded: statusCounts.uploaded || 0,
          processing: statusCounts.processing || 0,
          analyzed: statusCounts.analyzed || 0,
          matched: statusCounts.matched || 0,
          error: statusCounts.error || 0,
        },
      },
      recentActivity: recentUploads.map((c) => ({
        id: c._id,
        name: c.parsedData?.name || c.originalFileName,
        status: c.status,
        score: c.matchScore?.weightedFinalScore || null,
        jobTitle: c.jobDescription?.title || null,
        uploadedAt: c.createdAt,
      })),
      jobsOverview: topCandidatesPerJob,
    });
  } catch (error) {
    next(error);
  }
};

// ── Search and filter candidates (used by dashboard's search/filter UI) ───────
// GET /api/dashboard/search?q=...&minScore=...&status=...&skill=...
const searchCandidates = async (req, res, next) => {
  try {
    const { q, minScore, maxScore, status, skill, jobDescriptionId } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const filter = { recruiter: req.user._id };

    // Text search across name and original filename
    if (q) {
      filter.$or = [
        { originalFileName: { $regex: q, $options: "i" } },
        { "parsedData.name": { $regex: q, $options: "i" } },
        { "parsedData.email": { $regex: q, $options: "i" } },
      ];
    }

    if (status) filter.status = status;
    if (jobDescriptionId) filter.jobDescription = jobDescriptionId;

    if (skill) {
      filter["parsedData.skills"] = { $regex: skill, $options: "i" };
    }

    if (minScore || maxScore) {
      filter["matchScore.weightedFinalScore"] = {};
      if (minScore) filter["matchScore.weightedFinalScore"].$gte = parseFloat(minScore);
      if (maxScore) filter["matchScore.weightedFinalScore"].$lte = parseFloat(maxScore);
    }

    const skip = (page - 1) * limit;

    const [candidates, total] = await Promise.all([
      Candidate.find(filter)
        .select(
          "originalFileName status parsedData.name parsedData.email parsedData.skills matchScore.weightedFinalScore rank createdAt"
        )
        .populate("jobDescription", "title")
        .sort({ "matchScore.weightedFinalScore": -1, createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Candidate.countDocuments(filter),
    ]);

    return sendSuccess(res, 200, "Search results retrieved", {
      candidates,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalResults: total,
      },
      filtersApplied: { q, status, skill, minScore, maxScore, jobDescriptionId },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getDashboard, searchCandidates };