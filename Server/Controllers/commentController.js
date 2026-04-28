const mongoose = require('mongoose');
const { validationResult } = require('express-validator');
const Comment      = require('../Models/commentModel');
const Post         = require('../Models/postModel');
const Community    = require('../Models/communityModel');
const Membership   = require('../Models/membershipModel');
const SavedComment = require('../Models/savedCommentModel');
const { createNotification, extractMentions } = require('../Utils/notificationHelper');

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE     = 50;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const isValidObjectId = (id) =>
  typeof id === 'string' && mongoose.Types.ObjectId.isValid(id);

// Returns the community if the caller is allowed to view it, null otherwise.
// Private communities are invisible (404, not 403) to non-members.
const findViewableCommunity = async (communityId, userId) => {
  const community = await Community.findById(communityId);
  if (!community) return null;

  if (community.type === 'private') {
    if (!userId) return null;
    const membership = await Membership.findOne({ user: userId, community: community._id });
    if (!membership) return null;
  }

  return community;
};

// ─── @route  GET /reddit/posts/:postId/comments ──────────────────────────────
// ─── @access Public (private communities: members only) ──────────────────────
const listComments = async (req, res) => {
  const { postId } = req.params;
  if (!isValidObjectId(postId))
    return res.status(404).json({ success: false, message: 'Post not found' });

  const userId = req.user ? req.user.id : null;

  try {
    const post = await Post.findById(postId);
    if (!post || post.isDeleted)
      return res.status(404).json({ success: false, message: 'Post not found' });

    const community = await findViewableCommunity(post.community, userId);
    if (!community)
      return res.status(404).json({ success: false, message: 'Post not found' });

    // Return all comments flat — frontend assembles tree from parent + depth fields
    const comments = await Comment.find({ post: postId })
      .sort({ createdAt: 1 })
      .populate('author', 'username');

    res.status(200).json({ success: true, total: comments.length, comments });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// ─── @route  POST /reddit/posts/:postId/comments ─────────────────────────────
// ─── @access Private ─────────────────────────────────────────────────────────
const createComment = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ success: false, errors: errors.array() });

  const { postId } = req.params;
  if (!isValidObjectId(postId))
    return res.status(404).json({ success: false, message: 'Post not found' });

  const { body } = req.body;

  try {
    const post = await Post.findById(postId);
    if (!post || post.isDeleted)
      return res.status(404).json({ success: false, message: 'Post not found' });

    const membership = await Membership.findOne({ user: req.user.id, community: post.community });
    if (!membership)
      return res.status(403).json({ success: false, message: 'You must join this community before commenting' });

    // Resolve mentions before saving so they're stored on the document
    const mentionedUserIds = await extractMentions(body);

    const comment = await Comment.create({
      post:     postId,
      author:   req.user.id,
      parent:   null,
      depth:    0,
      body,
      mentions: mentionedUserIds,
    });

    const populated = await Comment.findById(comment._id).populate('author', 'username');

    res.status(201).json({ success: true, message: 'Comment created', comment: populated });

    // ── Fire notifications (after response — never block the caller) ──────────
    const actorId    = req.user.id;
    const postAuthor = String(post.author);
    const alreadyNotified = new Set();

    if (actorId !== postAuthor) {
      await createNotification({
        recipient: post.author,
        actor:     actorId,
        type:      'post_comment',
        post:      post._id,
        comment:   comment._id,
      });
      alreadyNotified.add(postAuthor);
    }

    for (const mentionedId of mentionedUserIds) {
      const mentionedStr = String(mentionedId);
      if (mentionedStr === actorId || alreadyNotified.has(mentionedStr)) continue;
      await createNotification({
        recipient: mentionedId,
        actor:     actorId,
        type:      'mention',
        post:      post._id,
        comment:   comment._id,
      });
      alreadyNotified.add(mentionedStr);
    }
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ success: false, message: messages[0] });
    }
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// ─── @route  POST /reddit/comments/:id/reply ─────────────────────────────────
// ─── @access Private ─────────────────────────────────────────────────────────
const createReply = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ success: false, errors: errors.array() });

  const { id } = req.params;
  if (!isValidObjectId(id))
    return res.status(404).json({ success: false, message: 'Comment not found' });

  const { body } = req.body;

  try {
    const parent = await Comment.findById(id);
    if (!parent)
      return res.status(404).json({ success: false, message: 'Comment not found' });

    if (parent.depth >= Comment.MAX_DEPTH)
      return res.status(400).json({ success: false, message: `Cannot reply beyond depth ${Comment.MAX_DEPTH}` });

    const post = await Post.findById(parent.post);
    if (!post || post.isDeleted)
      return res.status(404).json({ success: false, message: 'Post not found' });

    const membership = await Membership.findOne({ user: req.user.id, community: post.community });
    if (!membership)
      return res.status(403).json({ success: false, message: 'You must join this community before commenting' });

    const mentionedUserIds = await extractMentions(body);

    const comment = await Comment.create({
      post:     parent.post,
      author:   req.user.id,
      parent:   parent._id,
      depth:    parent.depth + 1,
      body,
      mentions: mentionedUserIds,
    });

    const populated = await Comment.findById(comment._id).populate('author', 'username');

    res.status(201).json({ success: true, message: 'Reply created', comment: populated });

    // ── Fire notifications ────────────────────────────────────────────────────
    const actorId      = req.user.id;
    const parentAuthor = String(parent.author);
    const postAuthor   = String(post.author);
    const alreadyNotified = new Set();

    if (actorId !== parentAuthor) {
      await createNotification({
        recipient: parent.author,
        actor:     actorId,
        type:      'comment_reply',
        post:      post._id,
        comment:   comment._id,
      });
      alreadyNotified.add(parentAuthor);
    }

    if (actorId !== postAuthor && !alreadyNotified.has(postAuthor)) {
      await createNotification({
        recipient: post.author,
        actor:     actorId,
        type:      'post_comment',
        post:      post._id,
        comment:   comment._id,
      });
      alreadyNotified.add(postAuthor);
    }

    for (const mentionedId of mentionedUserIds) {
      const mentionedStr = String(mentionedId);
      if (mentionedStr === actorId || alreadyNotified.has(mentionedStr)) continue;
      await createNotification({
        recipient: mentionedId,
        actor:     actorId,
        type:      'mention',
        post:      post._id,
        comment:   comment._id,
      });
      alreadyNotified.add(mentionedStr);
    }
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ success: false, message: messages[0] });
    }
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// ─── @route  PATCH /reddit/comments/:id ──────────────────────────────────────
// ─── @access Private (author only) ───────────────────────────────────────────
const updateComment = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ success: false, errors: errors.array() });

  const { id } = req.params;
  if (!isValidObjectId(id))
    return res.status(404).json({ success: false, message: 'Comment not found' });

  const { body } = req.body;

  try {
    const comment = await Comment.findById(id);
    if (!comment || comment.isDeleted)
      return res.status(404).json({ success: false, message: 'Comment not found' });

    if (!comment.author.equals(req.user.id))
      return res.status(403).json({ success: false, message: 'You can only edit your own comments' });

    comment.body     = body;
    comment.mentions = await extractMentions(body);
    await comment.save();

    const populated = await Comment.findById(comment._id).populate('author', 'username');

    res.status(200).json({ success: true, message: 'Comment updated', comment: populated });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ success: false, message: messages[0] });
    }
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// ─── @route  DELETE /reddit/comments/:id ─────────────────────────────────────
// ─── @access Private (author or admin) ───────────────────────────────────────
const deleteComment = async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id))
    return res.status(404).json({ success: false, message: 'Comment not found' });

  try {
    const comment = await Comment.findById(id);
    if (!comment || comment.isDeleted)
      return res.status(404).json({ success: false, message: 'Comment not found' });

    const isAuthor = comment.author.equals(req.user.id);
    const isAdmin  = req.user.role === 'admin';
    if (!isAuthor && !isAdmin)
      return res.status(403).json({ success: false, message: 'You can only delete your own comments' });

    // Soft-delete — children remain visible (Reddit behavior)
    comment.isDeleted = true;
    comment.deletedAt = new Date();
    await comment.save();

    res.status(200).json({ success: true, message: 'Comment deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// ─── @route  POST /reddit/comments/:id/save ──────────────────────────────────
// ─── @access Private ─────────────────────────────────────────────────────────
const saveComment = async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id))
    return res.status(404).json({ success: false, message: 'Comment not found' });

  try {
    const comment = await Comment.findById(id);
    if (!comment || comment.isDeleted)
      return res.status(404).json({ success: false, message: 'Comment not found' });

    try {
      await SavedComment.create({ user: req.user.id, comment: comment._id });
      return res.status(201).json({ success: true, message: 'Comment saved' });
    } catch (err) {
      if (err.code === 11000)
        return res.status(200).json({ success: true, message: 'Comment already saved', alreadySaved: true });
      throw err;
    }
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// ─── @route  DELETE /reddit/comments/:id/save ────────────────────────────────
// ─── @access Private ─────────────────────────────────────────────────────────
const unsaveComment = async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id))
    return res.status(404).json({ success: false, message: 'Comment not found' });

  try {
    const result = await SavedComment.deleteOne({ user: req.user.id, comment: id });
    if (result.deletedCount === 0)
      return res.status(200).json({ success: true, message: 'Comment was not saved', alreadyUnsaved: true });
    res.status(200).json({ success: true, message: 'Comment unsaved' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// ─── @route  GET /reddit/comments/saved ──────────────────────────────────────
// ─── @access Private ─────────────────────────────────────────────────────────
const listSavedComments = async (req, res) => {
  const page  = Math.max(1, parseInt(req.query.page,  10) || 1);
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(req.query.limit, 10) || DEFAULT_PAGE_SIZE));
  const skip  = (page - 1) * limit;

  try {
    const [savedDocs, total] = await Promise.all([
      SavedComment.find({ user: req.user.id })
        .sort({ savedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({
          path:     'comment',
          populate: { path: 'author', select: 'username' },
        })
        .populate('comment.post', 'title'),
      SavedComment.countDocuments({ user: req.user.id }),
    ]);

    const comments = savedDocs.map(s => ({
      ...s.comment.toJSON(),
      savedAt: s.savedAt,
    }));

    res.status(200).json({
      success: true,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      comments,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

module.exports = {
  listComments,
  createComment,
  createReply,
  updateComment,
  deleteComment,
  saveComment,
  unsaveComment,
  listSavedComments,
};
