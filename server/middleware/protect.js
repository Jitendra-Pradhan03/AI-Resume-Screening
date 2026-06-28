// server/middleware/protect.js
// Why this file exists: Guards private routes. Without this, anyone could
// call /api/dashboard without logging in.
// How it connects: Added to any route that requires authentication:
//   router.get("/dashboard", protect, dashboardController.getData)
// Key concept: Bearer token pattern — client sends "Authorization: Bearer <token>"
// with every request. We verify the token and attach the user to req so
// controllers know who is making the request.

const User = require("../models/User");
const { verifyToken } = require("../utils/jwtHelper");

const protect = async (req, res, next) => {
  try {
    let token;

    // Extract token from Authorization header: "Bearer eyJhbGci..."
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer ")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access denied. No token provided. Please login.",
      });
    }

    // Verify signature and expiry — throws if invalid
    const decoded = verifyToken(token);

    // Fetch fresh user data from DB (catches deleted/deactivated accounts)
    // We explicitly select password: false was set in schema, so it's excluded
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User belonging to this token no longer exists.",
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: "Your account has been deactivated. Please contact support.",
      });
    }

    // Attach user document to req — controllers can now access req.user
    req.user = user;
    next();
  } catch (error) {
    // verifyToken throws JsonWebTokenError or TokenExpiredError
    // These are caught and formatted by our global errorHandler
    next(error);
  }
};

module.exports = protect;