const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User = require('../Models/authModel');
const Post = require('../Models/postModel');

const generateAccessToken = (userId, role) =>
  jwt.sign({ id: userId, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });

const generateRefreshToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
  });

const updateProfile = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ success: false, errors: errors.array() });

  const { username, email } = req.body;

  if (req.body.password || req.body.role)
    return res.status(400).json({
      success: false,
      message: 'Password and role cannot be updated through this endpoint',
    });

  try {
    const user = await User.findById(req.user.id);
    if (!user)
      return res.status(404).json({ success: false, message: 'User not found' });

    if (username) {
      const existingUsername = await User.findOne({
        username,
        _id: { $ne: req.user.id },
      });
      if (existingUsername)
        return res.status(409).json({
          success: false,
          message: 'Username is already taken',
        });
      user.username = username;
    }

    if (email) {
      const existingEmail = await User.findOne({
        email,
        _id: { $ne: req.user.id },
      });
      if (existingEmail)
        return res.status(409).json({
          success: false,
          message: 'Email is already in use',
        });
      user.email = email;
    }

    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

const changePassword = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ success: false, errors: errors.array() });

  const { currentPassword, newPassword } = req.body;

  try {
    const user = await User.findById(req.user.id).select('+password');
    if (!user)
      return res.status(404).json({ success: false, message: 'User not found' });

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch)
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });

    user.password = newPassword;

    const accessToken = generateAccessToken(user._id, user.role);
    const refreshToken = generateRefreshToken(user._id);
    user.refreshToken = User.hashToken(refreshToken);

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password changed successfully',
      accessToken,
      refreshToken,
      user,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// ─── @route  GET /reddit/users/:username/posts ────────────────────────────────
// ─── @access Public ──────────────────────────────────────────────────────────
const getUserPosts = async (req, res) => {
  const page  = Math.max(1, parseInt(req.query.page,  10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const skip  = (page - 1) * limit;

  try {
    const user = await User.findOne({ username: req.params.username, isActive: true }).select('_id username');
    if (!user)
      return res.status(404).json({ success: false, message: 'User not found' });

    const [posts, total] = await Promise.all([
      Post.find({ author: user._id, isDeleted: false })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('author', 'username')
        .populate('community', 'name'),
      Post.countDocuments({ author: user._id, isDeleted: false }),
    ]);

    res.status(200).json({
      success: true,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      posts,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

module.exports = { updateProfile, changePassword, getUserPosts };
