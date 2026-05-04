const jwt = require('jsonwebtoken');
const User = require('../Models/authModel');
const Conversation = require('../Models/conversationModel');
const Message = require('../Models/messageModel');

// Verify JWT and return { id, role } — mirrors the protect middleware logic
const authenticateSocket = async (socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (!token) return next(new Error('No token provided'));

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('+passwordChangedAt');

    if (!user) return next(new Error('User no longer exists'));
    if (!user.isActive) return next(new Error('Account is deactivated'));
    if (user.changedPasswordAfter(decoded.iat)) return next(new Error('Password changed. Please log in again'));

    socket.userId = String(user._id);
    socket.userRole = user.role;
    next();
  } catch {
    next(new Error('Invalid or expired token'));
  }
};

const isParticipant = (conversation, userId) =>
  conversation.participants.some((p) => String(p) === userId);

module.exports = (io) => {
  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    // Join a conversation room — validates the user is a participant first
    socket.on('chat:join', async ({ conversationId } = {}) => {
      try {
        if (!conversationId) return;
        const conversation = await Conversation.findById(conversationId);
        if (!conversation || !isParticipant(conversation, socket.userId)) return;
        socket.join(conversationId);
      } catch {
        // silently ignore — client will retry
      }
    });

    // Send a message — persisted then broadcast to the conversation room
    socket.on('chat:message', async ({ conversationId, body } = {}) => {
      try {
        if (!conversationId || !body?.trim()) return;

        const conversation = await Conversation.findById(conversationId);
        if (!conversation || !isParticipant(conversation, socket.userId)) return;

        const message = await Message.create({
          conversation: conversationId,
          sender: socket.userId,
          body: body.trim().slice(0, 2000),
          readBy: [socket.userId],
        });

        // Increment unread count for the other participant
        const otherId = conversation.participants
          .map(String)
          .find((id) => id !== socket.userId);

        const currentUnread = conversation.unreadCounts.get(otherId) || 0;
        conversation.unreadCounts.set(otherId, currentUnread + 1);
        conversation.lastMessage = message._id;
        conversation.lastMessageAt = message.createdAt;
        await conversation.save();

        const populated = await message.populate('sender', 'username');

        io.to(conversationId).emit('chat:message', { message: populated });
      } catch {
        socket.emit('chat:error', { message: 'Failed to send message' });
      }
    });

    // Typing indicator — broadcast only, no DB write
    socket.on('chat:typing', async ({ conversationId, isTyping } = {}) => {
      try {
        if (!conversationId) return;
        const conversation = await Conversation.findById(conversationId);
        if (!conversation || !isParticipant(conversation, socket.userId)) return;
        socket.to(conversationId).emit('chat:typing', { userId: socket.userId, isTyping: !!isTyping });
      } catch {
        // silently ignore
      }
    });

    // Mark all messages in a conversation as read by this user
    socket.on('chat:read', async ({ conversationId } = {}) => {
      try {
        if (!conversationId) return;

        const conversation = await Conversation.findById(conversationId);
        if (!conversation || !isParticipant(conversation, socket.userId)) return;

        await Message.updateMany(
          { conversation: conversationId, readBy: { $ne: socket.userId } },
          { $addToSet: { readBy: socket.userId } }
        );

        conversation.unreadCounts.set(socket.userId, 0);
        await conversation.save();

        socket.to(conversationId).emit('chat:read', { userId: socket.userId, conversationId });
      } catch {
        // silently ignore
      }
    });
  });
};