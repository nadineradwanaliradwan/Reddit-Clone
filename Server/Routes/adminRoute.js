const express = require('express');
const { protect, restrictTo } = require('../Middlewares/authMiddleware');
const { getAllUsers, toggleUserStatus } = require('../Controllers/adminController');

const router = express.Router();

router.use(protect);
router.use(restrictTo('admin'));

router.get('/users', getAllUsers); // tested
router.patch('/users/:id/status', toggleUserStatus); // tested

module.exports = router;
