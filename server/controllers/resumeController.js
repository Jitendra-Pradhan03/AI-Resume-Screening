// server/controllers/resumeController.js
// Why this file exists: Handles all resume-related operations — upload,
// list, retrieve, delete.
// How it connects: Called by resumeRoutes. Uses the Candidate model to
// persist data. The Python AI step (added later) will be triggered from
// the uploadResume function via a service call.
// Key concept: req.file is populated by Multer middleware before this
// controller runs — we just read its properties.
const { analyzeResume } = require("../services/aiService"); 
const path = require("path");
const fs = require("fs");
const Candidate = require("../models/Candidate");
const { sendSuccess, sendError } = require("../utils/apiResponse");

// ── Upload resume ─────────────────────────────────────────────────────────────
// POST /api/resume/upload
// Multer middleware runs first and saves the file, then this runs.
const uploadResume = async (req, res, next) => {
  try {
    // If Multer rejected the file (wrong type), req.file will be undefined
    if (!req.file) {
      return sendError(res, 400, "No file uploaded. Please upload a PDF file.");
    }

    const { originalname, filename, path: filePath, size, mimetype } = req.file;

    // Build the candidate document with file metadata
    // parsedData and matchScore are left empty — the AI module fills them
    const candidate = await Candidate.create({
      recruiter: req.user._id,
      originalFileName: originalname,
      storedFileName: filename,
      filePath: filePath,
      fileSize: size,
      mimeType: mimetype,
      status: "processing",
    });
    setImmediate(async () => {
    try {
    // await Candidate.findByIdAndUpdate(candidate._id, { status: "processing" });

    const aiResult = await analyzeResume(filePath);

    if (aiResult.success) {
      await Candidate.findByIdAndUpdate(candidate._id, {
        status: "analyzed",
        parsedData: aiResult.data,
      });
    } else {
      await Candidate.findByIdAndUpdate(candidate._id, {
        status: "error",
        errorMessage: aiResult.error,
      });
    }
  } catch (err) {
    console.error("Background AI analysis failed:", err.message);
    await Candidate.findByIdAndUpdate(candidate._id, {
      status: "error",
      errorMessage: err.message,
    });
  }
  });
    return sendSuccess(res, 201, "Resume uploaded successfully", {
      candidate: {
        id: candidate._id,
        originalFileName: candidate.originalFileName,
        fileSize: candidate.fileSize,
        status: candidate.status,
        uploadedAt: candidate.createdAt,
        // URL the frontend can use to display/download the PDF
        fileUrl: `${req.protocol}://${req.get("host")}/uploads/${candidate.storedFileName}`,
      },
    });
  } catch (error) {
    // If DB save fails after file was saved to disk, clean up the orphaned file
    if (req.file && req.file.path) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error("Failed to clean up orphaned file:", err);
      });
    }
    next(error);
  }
};

// ── Get all resumes for logged-in recruiter ───────────────────────────────────
// GET /api/resume
const getAllResumes = async (req, res, next) => {
  try {
    // Pagination — default page 1, 10 results per page
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Filter options from query params
    const filter = { recruiter: req.user._id };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.jobDescription) filter.jobDescription = req.query.jobDescription;

    const [candidates, total] = await Promise.all([
      Candidate.find(filter)
        .select("-parsedData.rawText -interviewQuestions") // exclude heavy fields from list
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("jobDescription", "title company"),
      Candidate.countDocuments(filter),
    ]);

    return sendSuccess(res, 200, "Resumes retrieved successfully", {
      candidates,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalCandidates: total,
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ── Get single candidate by ID ────────────────────────────────────────────────
// GET /api/resume/:id
const getResumeById = async (req, res, next) => {
  try {
    const candidate = await Candidate.findOne({
      _id: req.params.id,
      recruiter: req.user._id, // ensure recruiter can only access their own
    }).populate("jobDescription", "title company description");

    if (!candidate) {
      return sendError(res, 404, "Candidate not found");
    }

    // Build the file URL for the frontend PDF viewer
    const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${candidate.storedFileName}`;

    return sendSuccess(res, 200, "Candidate retrieved successfully", {
      candidate,
      fileUrl,
    });
  } catch (error) {
    next(error);
  }
};

// ── Delete a resume ───────────────────────────────────────────────────────────
// DELETE /api/resume/:id
const deleteResume = async (req, res, next) => {
  try {
    const candidate = await Candidate.findOne({
      _id: req.params.id,
      recruiter: req.user._id,
    });

    if (!candidate) {
      return sendError(res, 404, "Candidate not found");
    }

    // Delete the physical PDF file from disk first
    const absolutePath = path.resolve(candidate.filePath);
    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }

    // Then remove the MongoDB document
    await candidate.deleteOne();

    return sendSuccess(res, 200, "Resume deleted successfully", {
      deletedId: req.params.id,
    });
  } catch (error) {
    next(error);
  }
};

// ── Update recruiter notes ────────────────────────────────────────────────────
// PATCH /api/resume/:id/notes
const updateNotes = async (req, res, next) => {
  try {
    const { recruiterNotes } = req.body;

    const candidate = await Candidate.findOneAndUpdate(
      { _id: req.params.id, recruiter: req.user._id },
      { recruiterNotes },
      { new: true, runValidators: true }
    );

    if (!candidate) {
      return sendError(res, 404, "Candidate not found");
    }

    return sendSuccess(res, 200, "Notes updated successfully", {
      recruiterNotes: candidate.recruiterNotes,
    });
  } catch (error) {
    next(error);
  }
};

// ── Get resume statistics for dashboard ──────────────────────────────────────
// GET /api/resume/stats
const getResumeStats = async (req, res, next) => {
  try {
    const recruiterId = req.user._id;

    // Run all counts in parallel for performance
    const [total, byStatus, recentUploads] = await Promise.all([
      Candidate.countDocuments({ recruiter: recruiterId }),

      // Group by status to get counts for each stage
      Candidate.aggregate([
        { $match: { recruiter: recruiterId } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),

      // Last 5 uploads for the "recent activity" section
      Candidate.find({ recruiter: recruiterId })
        .select("originalFileName status createdAt matchScore.weightedFinalScore")
        .sort({ createdAt: -1 })
        .limit(5),
    ]);

    // Convert the aggregate result to a clean object
    const statusCounts = byStatus.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {});

    return sendSuccess(res, 200, "Stats retrieved successfully", {
      total,
      statusCounts: {
        uploaded: statusCounts.uploaded || 0,
        processing: statusCounts.processing || 0,
        analyzed: statusCounts.analyzed || 0,
        matched: statusCounts.matched || 0,
        error: statusCounts.error || 0,
      },
      recentUploads,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  uploadResume,
  getAllResumes,
  getResumeById,
  deleteResume,
  updateNotes,
  getResumeStats,
};