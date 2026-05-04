const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { validationResult } = require('express-validator');
const User = require('../Models/authModel');
const { sendPasswordResetEmail } = require('../Config/email');

// ─── Token Helpers ────────────────────────────────────────────────────────────

const generateAccessToken = (userId, role) =>
  jwt.sign({ id: userId, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });

const generateRefreshToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
  });

// ─── @route  POST /api/auth/register ─────────────────────────────────────────
// ─── @access Public ──────────────────────────────────────────────────────────
const register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ success: false, errors: errors.array() });

  const { username, email, password } = req.body;

  try {
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      const field = existingUser.email === email ? 'Email' : 'Username';
      return res.status(409).json({ success: false, message: `${field} already in use` });
    }

    const user = await User.create({ username, email, password });

    const accessToken = generateAccessToken(user._id, user.role);
    const refreshToken = generateRefreshToken(user._id);

    // Store hashed refresh token — raw token is only sent to client
    user.refreshToken = User.hashToken(refreshToken);
    await user.save({ validateBeforeSave: false });

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      accessToken,
      refreshToken,
      user,
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ success: false, message: messages[0] });
    }
    if (err.code === 11000) {
      const field = Object.keys(err.keyValue)[0];
      return res.status(409).json({ success: false, message: `${field.charAt(0).toUpperCase() + field.slice(1)} already in use` });
    }
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// ─── @route  POST /api/auth/login ─────────────────────────────────────────────
// ─── @access Public ──────────────────────────────────────────────────────────
const login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ success: false, errors: errors.array() });

  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email }).select('+password +loginAttempts +lockUntil');

    // Unknown email — same message as wrong password to prevent user enumeration
    if (!user)
      return res.status(401).json({ success: false, message: 'Invalid email or password' });

    // Account is locked
    if (user.isLocked)
      return res.status(423).json({
        success: false,
        message: 'Account locked due to too many failed attempts. Try again in 30 minutes',
      });

    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      await user.incrementLoginAttempts();
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    // Check account status after verifying password
    if (!user.isActive)
      return res.status(403).json({ success: false, message: 'Account is deactivated' });

    // Successful login — reset failed attempts
    await user.resetLoginAttempts();

    const accessToken = generateAccessToken(user._id, user.role);
    const refreshToken = generateRefreshToken(user._id);

    user.refreshToken = User.hashToken(refreshToken);
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      success: true,
      message: 'Logged in successfully',
      accessToken,
      refreshToken,
      user,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// ─── @route  POST /api/auth/refresh ──────────────────────────────────────────
// ─── @access Public (requires valid refresh token) ───────────────────────────
const refresh = async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken)
    return res.status(401).json({ success: false, message: 'Refresh token required' });

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    const hashedToken = User.hashToken(refreshToken);
    const user = await User.findById(decoded.id).select('+refreshToken');

    // Token must exist in DB and match the stored hash
    if (!user || user.refreshToken !== hashedToken)
      return res.status(403).json({ success: false, message: 'Invalid or expired refresh token' });

    const newAccessToken = generateAccessToken(user._id, user.role);
    const newRefreshToken = generateRefreshToken(user._id);

    user.refreshToken = User.hashToken(newRefreshToken);
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      success: true,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (err) {
    res.status(403).json({ success: false, message: 'Invalid or expired refresh token' });
  }
};

// ─── @route  POST /api/auth/logout ───────────────────────────────────────────
// ─── @access Private ─────────────────────────────────────────────────────────
const logout = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, { refreshToken: null });
    res.status(200).json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// ─── @route  GET /api/auth/me ─────────────────────────────────────────────────
// ─── @access Private ─────────────────────────────────────────────────────────
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.status(200).json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

module.exports = { register, login, refresh, logout, getMe};
