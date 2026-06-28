// server/controllers/jobController.js
// Why this file exists: Manages job descriptions that resumes are matched against.
// How it connects: Routes POST /api/job to create a JD, GET to list them.
// The matching step reads the JD from MongoDB when running AI analysis.

const JobDescription = require("../models/JobDescription");
const { sendSuccess, sendError } = require("../utils/apiResponse");

// ── Create job description ────────────────────────────────────────────────────
// POST /api/job
// Accepts either pasted text or a plain text file upload
const createJobDescription = async (req, res, next) => {
  try {
    const { title, company, description, source } = req.body;

    if (!title || !title.trim()) {
      return sendError(res, 400, "Job title is required");
    }

    if (!description || description.trim().length < 50) {
      return sendError(
        res,
        400,
        "Job description must be at least 50 characters"
      );
    }

    const jobDescription = await JobDescription.create({
      recruiter: req.user._id,
      title: title.trim(),
      company: company ? company.trim() : req.user.company || "",
      description: description.trim(),
      source: source || "pasted",
    });

    return sendSuccess(res, 201, "Job description saved successfully", {
      jobDescription: {
        id: jobDescription._id,
        title: jobDescription.title,
        company: jobDescription.company,
        source: jobDescription.source,
        createdAt: jobDescription.createdAt,
        // Show a preview — first 200 characters
        preview: jobDescription.description.substring(0, 200) + "...",
      },
    });
  } catch (error) {
    next(error);
  }
};

// ── Get all job descriptions for this recruiter ───────────────────────────────
// GET /api/job
const getAllJobDescriptions = async (req, res, next) => {
  try {
    const jobDescriptions = await JobDescription.find({
      recruiter: req.user._id,
      isActive: true,
    })
      .select("-embedding") // exclude the large embedding array from list view
      .sort({ createdAt: -1 });

    return sendSuccess(res, 200, "Job descriptions retrieved", {
      jobDescriptions,
      total: jobDescriptions.length,
    });
  } catch (error) {
    next(error);
  }
};

// ── Get single job description ────────────────────────────────────────────────
// GET /api/job/:id
const getJobDescriptionById = async (req, res, next) => {
  try {
    const jobDescription = await JobDescription.findOne({
      _id: req.params.id,
      recruiter: req.user._id,
    }).select("-embedding");

    if (!jobDescription) {
      return sendError(res, 404, "Job description not found");
    }

    return sendSuccess(res, 200, "Job description retrieved", {
      jobDescription,
    });
  } catch (error) {
    next(error);
  }
};

// ── Update job description ────────────────────────────────────────────────────
// PUT /api/job/:id
const updateJobDescription = async (req, res, next) => {
  try {
    const { title, company, description } = req.body;

    const jobDescription = await JobDescription.findOneAndUpdate(
      { _id: req.params.id, recruiter: req.user._id },
      {
        title,
        company,
        description,
        // Reset AI-generated fields when JD is edited
        extractedSkills: [],
        embedding: [],
      },
      { new: true, runValidators: true }
    );

    if (!jobDescription) {
      return sendError(res, 404, "Job description not found");
    }

    return sendSuccess(res, 200, "Job description updated", { jobDescription });
  } catch (error) {
    next(error);
  }
};

// ── Delete (soft delete) job description ─────────────────────────────────────
// DELETE /api/job/:id
const deleteJobDescription = async (req, res, next) => {
  try {
    const jobDescription = await JobDescription.findOneAndUpdate(
      { _id: req.params.id, recruiter: req.user._id },
      { isActive: false },
      { new: true }
    );

    if (!jobDescription) {
      return sendError(res, 404, "Job description not found");
    }

    return sendSuccess(res, 200, "Job description deleted", {
      deletedId: req.params.id,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createJobDescription,
  getAllJobDescriptions,
  getJobDescriptionById,
  updateJobDescription,
  deleteJobDescription,
};