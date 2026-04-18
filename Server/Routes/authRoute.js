const express = require('express');
const { body } = require('express-validator');
const { register, login, refresh, logout, getMe, forgotPassword, resetPassword } = require('../Controllers/authController');
const { protect } = require('../Middlewares/authMiddleware');

const router = express.Router();

// ─── Validation Rules ─────────────────────────────────────────────────────────

const registerValidation = [
  body('username')
    .trim()
    .isLength({ min: 3 }).withMessage('Username must be at least 3 characters')
    .isLength({ max: 30 }).withMessage('Username cannot exceed 30 characters')
    .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username can only contain letters, numbers, and underscores'),
  body('email')
    .trim()
    .isEmail()
    .withMessage('Please enter a valid email')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
];

const loginValidation = [
  body('email').trim().isEmail().withMessage('Please enter a valid email').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
];

// ─── Routes ──────────────────────────────────────────────────────────────────

router.post('/register', registerValidation, register); // tested
router.post('/login', loginValidation, login);// tested
router.post('/refresh', refresh);// tested
router.post('/logout', protect, logout);// tested
router.get('/me', protect, getMe);// tested
//router.post('/forgot-password', forgotPassword);
//router.patch('/reset-password/:token', resetPassword);

module.exports = router;
