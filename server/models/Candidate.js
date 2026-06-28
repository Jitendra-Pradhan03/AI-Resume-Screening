// server/models/Candidate.js
// Why this file exists: Stores all candidate data — file info, parsed resume
// content, AI analysis results, and interview questions — in one document.
// How it connects: Created on upload. Updated in place as the AI pipeline
// processes the resume. Read by the dashboard and candidate detail views.
// Key concept: We store the AI results inside the candidate document itself
// (embedded documents) rather than separate collections. This keeps all
// data for one candidate in one MongoDB read.

const mongoose = require("mongoose");

// ── Sub-schemas (embedded documents) ────────────────────────────────────────

const educationSchema = new mongoose.Schema({
  degree: { type: String, default: "" },
  institution: { type: String, default: "" },
  year: { type: String, default: "" },
  field: { type: String, default: "" },
});

const experienceSchema = new mongoose.Schema({
  title: { type: String, default: "" },
  company: { type: String, default: "" },
  duration: { type: String, default: "" },
  description: { type: String, default: "" },
});

const projectSchema = new mongoose.Schema({
  name: { type: String, default: "" },
  description: { type: String, default: "" },
  technologies: [{ type: String }],
});

const matchScoreSchema = new mongoose.Schema({
  overallScore: { type: Number, default: 0, min: 0, max: 100 },
  skillScore: { type: Number, default: 0, min: 0, max: 100 },
  experienceScore: { type: Number, default: 0, min: 0, max: 100 },
  educationScore: { type: Number, default: 0, min: 0, max: 100 },
  weightedFinalScore: { type: Number, default: 0, min: 0, max: 100 },
  matchedSkills: [{ type: String }],
  missingSkills: [{ type: String }],
  suggestedSkills: [{ type: String }],
});

const interviewQuestionSchema = new mongoose.Schema({
  question: { type: String, required: true },
  category: {
    type: String,
    enum: ["technical", "behavioral", "experience", "project"],
    default: "technical",
  },
  difficulty: {
    type: String,
    enum: ["easy", "medium", "hard"],
    default: "medium",
  },
  relatedSkill: { type: String, default: "" },
});

// ── Main Candidate schema ────────────────────────────────────────────────────

const candidateSchema = new mongoose.Schema(
  {
    // Who uploaded this resume
    recruiter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Recruiter reference is required"],
    },

    // Which job this resume was matched against (set during matching)
    jobDescription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "JobDescription",
      default: null,
    },

    // ── File information ───────────────────────────────────────────────────
    originalFileName: {
      type: String,
      required: [true, "Original file name is required"],
    },
    storedFileName: {
      type: String,
      required: [true, "Stored file name is required"],
    },
    filePath: {
      type: String,
      required: [true, "File path is required"],
    },
    fileSize: {
      type: Number,
      required: true,
    },
    mimeType: {
      type: String,
      default: "application/pdf",
    },

    // ── Processing status ──────────────────────────────────────────────────
    // Tracks which stage of the pipeline we're at
    status: {
      type: String,
      enum: ["uploaded", "processing", "analyzed", "matched", "error"],
      default: "uploaded",
    },
    errorMessage: {
      type: String,
      default: null,
    },

    // ── Parsed resume data (filled by Python AI module) ────────────────────
    parsedData: {
      name: { type: String, default: "" },
      email: { type: String, default: "" },
      phone: { type: String, default: "" },
      linkedin: { type: String, default: "" },
      github: { type: String, default: "" },
      summary: { type: String, default: "" },
      totalExperienceYears: { type: Number, default: 0 },
      skills: [{ type: String }],
      education: [educationSchema],
      experience: [experienceSchema],
      projects: [projectSchema],
      certifications: [{ type: String }],
      rawText: { type: String, default: "" }, // full extracted text
    },

    // ── AI match results (filled after matching against a job description) ─
    matchScore: {
      type: matchScoreSchema,
      default: null,
    },

    // ── Generated interview questions ──────────────────────────────────────
    interviewQuestions: [interviewQuestionSchema],

    // ── Ranking position (set after all candidates for a job are scored) ───
    rank: {
      type: Number,
      default: null,
    },

    // ── Notes by recruiter ─────────────────────────────────────────────────
    recruiterNotes: {
      type: String,
      default: "",
      maxlength: [1000, "Notes cannot exceed 1000 characters"],
    },
  },
  {
    timestamps: true,
  }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
// Speed up the most common queries
candidateSchema.index({ recruiter: 1, createdAt: -1 }); // dashboard list
candidateSchema.index({ jobDescription: 1, "matchScore.weightedFinalScore": -1 }); // rankings
candidateSchema.index({ status: 1 }); // filter by status

const Candidate = mongoose.model("Candidate", candidateSchema);

module.exports = Candidate;