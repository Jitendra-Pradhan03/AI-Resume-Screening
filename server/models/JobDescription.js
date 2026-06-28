// server/models/JobDescription.js
// Why this file exists: Stores job descriptions that resumes are matched against.
// A recruiter can upload multiple JDs and match different resume batches to each.
// How it connects: Referenced by Candidate.jobDescription. Used in the
// matching step to compare resume embeddings against JD embeddings.

const mongoose = require("mongoose");

const jobDescriptionSchema = new mongoose.Schema(
  {
    recruiter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      required: [true, "Job title is required"],
      trim: true,
      maxlength: [150, "Job title cannot exceed 150 characters"],
    },
    company: {
      type: String,
      trim: true,
      default: "",
    },
    description: {
      type: String,
      required: [true, "Job description text is required"],
      minlength: [50, "Job description must be at least 50 characters"],
    },
    // Source: typed directly or uploaded as a file
    source: {
      type: String,
      enum: ["pasted", "uploaded"],
      default: "pasted",
    },
    // Required skills extracted from the JD (filled by Python AI)
    extractedSkills: [{ type: String }],
    // Embedding vector stored as array (filled by Python AI)
    embedding: [{ type: Number }],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

jobDescriptionSchema.index({ recruiter: 1, createdAt: -1 });

const JobDescription = mongoose.model("JobDescription", jobDescriptionSchema);

module.exports = JobDescription;