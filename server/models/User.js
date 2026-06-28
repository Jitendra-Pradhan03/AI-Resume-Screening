// server/models/User.js
// Why this file exists: Defines the structure of recruiter accounts in MongoDB.
// How it connects: Used by authController to create/find users. Mongoose
// automatically creates a "users" collection from this schema.
// Key concepts: Schema validation, pre-save hooks for hashing, instance
// methods for password comparison.

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [50, "Name cannot exceed 50 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please enter a valid email address",
      ],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false, // Never return password in queries by default
    },
    role: {
      type: String,
      enum: ["recruiter", "admin"],
      default: "recruiter",
    },
    company: {
      type: String,
      trim: true,
      maxlength: [100, "Company name cannot exceed 100 characters"],
    },
    avatar: {
      type: String,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
  }
);

// ── Pre-save hook ────────────────────────────────────────────────────────────
// Runs before every .save() — hashes the password only if it was changed.
// This means updating the user's name won't re-hash the existing password.
// Hash password before saving
userSchema.pre("save", async function () {
  // Only hash if the password was modified
  if (!this.isModified("password")) return;

  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

// ── Instance method ──────────────────────────────────────────────────────────
// Called on a user document: user.comparePassword(enteredPassword)
// Returns true if the plain text password matches the stored hash.
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// ── Transform output ─────────────────────────────────────────────────────────
// When .toJSON() is called (which res.json() triggers), remove __v and password
userSchema.methods.toJSON = function () {
  const user = this.toObject();
  delete user.password;
  delete user.__v;
  return user;
};

const User = mongoose.model("User", userSchema);

module.exports = User;