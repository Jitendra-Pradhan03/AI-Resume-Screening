// server/controllers/authController.js
// Why this file exists: Contains the actual logic for what happens when a
// recruiter registers or logs in. Routes call these functions.
// How it connects: Imported by authRoutes.js and mapped to POST endpoints.
// Key concepts: async/await with try/catch, sending consistent responses
// via apiResponse utility, JWT generation after successful auth.

const User = require("../models/User");
const { generateToken } = require("../utils/jwtHelper");
const { sendSuccess, sendError } = require("../utils/apiResponse");

// ── Register ─────────────────────────────────────────────────────────────────
// POST /api/auth/register
// Creates a new recruiter account
const register = async (req, res, next) => {
  try {
    const { name, email, password, company } = req.body;

    // Manual validation — check required fields
    if (!name || !email || !password) {
      return sendError(res, 400, "Please provide name, email, and password");
    }

    // Check if email already exists (Mongoose unique will also catch this,
    // but this gives a cleaner error message)
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return sendError(res, 400, "An account with this email already exists");
    }

    // Create user — the pre-save hook in User.js will hash the password
    const user = await User.create({
      name,
      email,
      password,
      company: company || "",
    });

    // Generate token for immediate login after registration
    const token = generateToken(user._id);

    return sendSuccess(res, 201, "Account created successfully", {
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        company: user.company,
        role: user.role,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    next(error); // Pass to global errorHandler
  }
};

// ── Login ─────────────────────────────────────────────────────────────────────
// POST /api/auth/login
// Authenticates an existing recruiter
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return sendError(res, 400, "Please provide email and password");
    }

    // .select("+password") overrides the schema's select:false so we get
    // the hashed password back for comparison
    const user = await User.findOne({ email: email.toLowerCase() }).select(
      "+password"
    );

    if (!user) {
      // Generic message — don't reveal whether email exists or not
      return sendError(res, 401, "Invalid email or password");
    }

    // Compare entered plain text with stored hash
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return sendError(res, 401, "Invalid email or password");
    }

    if (!user.isActive) {
      return sendError(res, 401, "Account deactivated. Please contact support.");
    }

    // Update last login timestamp
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    const token = generateToken(user._id);

    return sendSuccess(res, 200, "Login successful", {
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        company: user.company,
        role: user.role,
        lastLogin: user.lastLogin,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ── Get current user ──────────────────────────────────────────────────────────
// GET /api/auth/me   (protected)
// Returns the logged-in user's profile — useful for the frontend to load
// user data from the stored token without prompting login again
const getMe = async (req, res, next) => {
  try {
    // req.user is attached by the protect middleware
    const user = await User.findById(req.user._id);

    if (!user) {
      return sendError(res, 404, "User not found");
    }

    return sendSuccess(res, 200, "User profile retrieved", {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        company: user.company,
        role: user.role,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ── Update profile ────────────────────────────────────────────────────────────
// PUT /api/auth/update-profile   (protected)
// Lets a recruiter update their name or company
const updateProfile = async (req, res, next) => {
  try {
    const { name, company } = req.body;

    // Only allow updating safe fields — never update role or email this way
    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { name, company },
      { new: true, runValidators: true } // new:true returns updated doc
    );

    return sendSuccess(res, 200, "Profile updated successfully", {
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        company: updatedUser.company,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ── Change password ───────────────────────────────────────────────────────────
// PUT /api/auth/change-password   (protected)
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return sendError(res, 400, "Please provide current and new password");
    }

    if (newPassword.length < 6) {
      return sendError(res, 400, "New password must be at least 6 characters");
    }

    // Fetch user with password field
    const user = await User.findById(req.user._id).select("+password");

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return sendError(res, 401, "Current password is incorrect");
    }

    user.password = newPassword;
    await user.save(); // pre-save hook will hash the new password

    const token = generateToken(user._id);

    return sendSuccess(res, 200, "Password changed successfully", { token });
  } catch (error) {
    next(error);
  }
};

module.exports = { register, login, getMe, updateProfile, changePassword };