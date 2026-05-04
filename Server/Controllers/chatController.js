const mongoose = require('mongoose');
const Conversation = require('../Models/conversationModel');
const Message = require('../Models/messageModel');
const User = require('../Models/authModel');

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// @route  POST /reddit/chat/conversations
// @access Private
const startConversation = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId || !isValidId(userId))
      return res.status(400).json({ success: false, message: 'Valid userId is required' });

    if (String(userId) === String(req.user.id))
      return res.status(400).json({ success: false, message: 'You cannot start a conversation with yourself' });

    const target = await User.findById(userId).select('username');
    if (!target)
      return res.status(404).json({ success: false, message: 'User not found' });

    // Sorted pair ensures the unique index is order-independent
    const sorted = [req.user.id, userId].map(String).sort();

    let conversation = await Conversation.findOne({ participants: { $all: sorted, $size: 2 } })
      .populate('participants', 'username')
      .populate({ path: 'lastMessage', select: 'body sender createdAt isDeleted' });

    if (!conversation) {
      conversation = await Conversation.create({ participants: sorted });
      conversation = await conversation.populate('participants', 'username');
    }

    res.status(200).json({ success: true, data: { conversation } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to start conversation', error: err.message });
  }
};

// @route  GET /reddit/chat/conversations
// @access Private
const getConversations = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const [conversations, total] = await Promise.all([
      Conversation.find({ participants: req.user.id })
        .sort({ lastMessageAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('participants', 'username')
        .populate({ path: 'lastMessage', select: 'body sender createdAt isDeleted' }),
      Conversation.countDocuments({ participants: req.user.id }),
    ]);

    const enriched = conversations.map((c) => {
      const obj = c.toObject();
      obj.unreadCount = c.unreadCounts.get(String(req.user.id)) || 0;
      obj.partner = obj.participants.find((p) => String(p._id) !== String(req.user.id));
      return obj;
    });

    res.status(200).json({
      success: true,
      data: { conversations: enriched, total, page, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch conversations', error: err.message });
  }
};

// @route  GET /reddit/chat/conversations/:conversationId/messages
// @access Private
const getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;

    if (!isValidId(conversationId))
      return res.status(400).json({ success: false, message: 'Invalid conversation ID' });

    const conversation = await Conversation.findById(conversationId);
    if (!conversation)
      return res.status(404).json({ success: false, message: 'Conversation not found' });

    const isParticipant = conversation.participants.some((p) => String(p) === String(req.user.id));
    if (!isParticipant)
      return res.status(403).json({ success: false, message: 'Access denied' });

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 30));
    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      Message.find({ conversation: conversationId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('sender', 'username'),
      Message.countDocuments({ conversation: conversationId }),
    ]);

    res.status(200).json({
      success: true,
      data: { messages: messages.reverse(), total, page, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch messages', error: err.message });
  }
};

// @route  DELETE /reddit/chat/messages/:messageId
// @access Private
const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;

    if (!isValidId(messageId))
      return res.status(400).json({ success: false, message: 'Invalid message ID' });

    const message = await Message.findById(messageId);
    if (!message)
      return res.status(404).json({ success: false, message: 'Message not found' });

    if (String(message.sender) !== String(req.user.id))
      return res.status(403).json({ success: false, message: 'You can only delete your own messages' });

    if (message.isDeleted)
      return res.status(400).json({ success: false, message: 'Message already deleted' });

    message.isDeleted = true;
    message.deletedAt = new Date();
    await message.save();

    const io = req.app.get('io');
    if (io) {
      io.to(String(message.conversation)).emit('chat:message:delete', {
        messageId: String(message._id),
        conversationId: String(message.conversation),
      });
    }

    res.status(200).json({ success: true, message: 'Message deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete message', error: err.message });
  }
};

// @route  GET /reddit/chat/unread-count
// @access Private
const getUnreadCount = async (req, res) => {
  try {
    const conversations = await Conversation.find({ participants: req.user.id }).select('unreadCounts');
    const total = conversations.reduce((sum, c) => sum + (c.unreadCounts.get(String(req.user.id)) || 0), 0);
    res.status(200).json({ success: true, data: { unreadCount: total } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch unread count', error: err.message });
  }
};

module.exports = { startConversation, getConversations, getMessages, deleteMessage, getUnreadCount };