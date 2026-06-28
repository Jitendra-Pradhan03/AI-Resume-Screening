// server/utils/jwtHelper.js
// Why this file exists: Centralizes token generation and verification so
// the same logic isn't duplicated in the controller and middleware.
// How it connects: Used by authController to generate tokens, and by
// protect middleware to verify them.
// Key concept: JWT has three parts — header.payload.signature. The
// signature is verified using JWT_SECRET, so only our server can issue valid tokens.

const jwt = require("jsonwebtoken");

// Generate a signed JWT for a given user ID
const generateToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
};

// Verify a token and return the decoded payload, or throw if invalid/expired
const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

module.exports = { generateToken, verifyToken };