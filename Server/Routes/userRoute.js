const express = require('express');
const { body } = require('express-validator');
const { updateProfile, changePassword } = require('../Controllers/userController');

const router = express.Router();

const profileValidation = [
  body('username')
    .optional()
    .trim()
    .isLength({ min: 3 })
    .withMessage('Username must be at least 3 characters'),
  body('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Please enter a valid email')
    .normalizeEmail(),
];

const passwordValidation = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters'),
];

router.patch('/me', profileValidation, updateProfile); //tested
router.patch('/me/password', passwordValidation, changePassword); //tested

module.exports = router;
