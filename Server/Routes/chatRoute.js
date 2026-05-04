const express = require('express');
const { body, param } = require('express-validator');
const { validationResult } = require('express-validator');
const {
  startConversation,
  getConversations,
  getMessages,
  deleteMessage,
  getUnreadCount,
} = require('../Controllers/chatController');

const router = express.Router();

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ success: false, errors: errors.array() });
  next();
};

router.get('/unread-count', getUnreadCount);

router.get('/conversations', getConversations);

router.post(
  '/conversations',
  body('userId').notEmpty().withMessage('userId is required'),
  validate,
  startConversation
);

router.get(
  '/conversations/:conversationId/messages',
  param('conversationId').isMongoId().withMessage('Invalid conversation ID'),
  validate,
  getMessages
);

router.delete(
  '/messages/:messageId',
  param('messageId').isMongoId().withMessage('Invalid message ID'),
  validate,
  deleteMessage
);

module.exports = router;