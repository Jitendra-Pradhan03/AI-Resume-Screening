// server/routes/authRoutes.js
// Why this file exists: Defines which URLs map to which controller functions.
// How it connects: Imported by app.js and mounted at /api/auth.
// Key concept: Express Router lets us define route groups cleanly.
// protect middleware is applied only to routes that need authentication.

const express = require("express");
const router = express.Router();

const {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
} = require("../controllers/authController");

const protect = require("../middleware/protect");

// Public routes — no token required
router.post("/register", register);
router.post("/login", login);

// Protected routes — token required (protect runs first)
router.get("/me", protect, getMe);
router.put("/update-profile", protect, updateProfile);
router.put("/change-password", protect, changePassword);

module.exports = router;