const mongoose = require('mongoose');
const { validationResult } = require('express-validator');
const Post = require('../Models/postModel');
const Community = require('../Models/communityModel');
const Membership = require('../Models/membershipModel');

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE     = 50;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const isValidObjectId = (id) =>
  typeof id === 'string' && mongoose.Types.ObjectId.isValid(id);

// Used in list / get endpoints.
// Private communities must behave as if they don't exist to non-members, so we
// return a 404 for both "missing" and "not allowed to view" cases.
const findViewableCommunity = async (name, userId) => {
  const community = await Community.findOne({ name: name.toLowerCase() });
  if (!community) return { community: null, reason: 'not_found' };

  if (community.type === 'private') {
    if (!userId) return { community: null, reason: 'not_found' };

    const membership = await Membership.findOne({ user: userId, community: community._id });
    if (!membership) return { community: null, reason: 'not_found' };
  }

  return { community, reason: null };
};

// Hide the post from non-members of a private community the same way we hide the community
const canUserViewPostInCommunity = async (community, userId) => {
  if (community.type !== 'private') return true;
  if (!userId) return false;
  const membership = await Membership.findOne({ user: userId, community: community._id });
  return !!membership;
};

// Enforce the community-level allowedPostTypes setting against the incoming post type
const isPostTypeAllowed = (community, postType) => {
  if (community.allowedPostTypes === 'any') return true;
  // When restricted to 'text' or 'link', image posts are never allowed
  return community.allowedPostTypes === postType;
};

// ─── @route  POST /reddit/posts ──────────────────────────────────────────────
// ─── @access Private ─────────────────────────────────────────────────────────
const createPost = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ success: false, errors: errors.array() });

  const { community: communityName, type, title, body, url, imageUrl } = req.body;

  try {
    const community = await Community.findOne({ name: String(communityName).toLowerCase() });
    if (!community)
      return res.status(404).json({ success: false, message: 'Community not found' });

    if (community.isArchived)
      return res.status(403).json({ success: false, message: 'This community is archived and does not accept new posts' });

    // Everyone (including creator) must have a membership record to post
    const membership = await Membership.findOne({ user: req.user.id, community: community._id });
    if (!membership)
      return res.status(403).json({ success: false, message: 'You must join this community before posting' });

    if (!isPostTypeAllowed(community, type))
      return res.status(403).json({
        success: false,
        message: `This community only allows '${community.allowedPostTypes}' posts`,
      });

    // Build the doc with only the fields relevant to the chosen type — keeps the
    // stored document tidy and avoids accidentally persisting a stray url on a text post.
    const doc = {
      author:    req.user.id,
      community: community._id,
      type,
      title,
    };
    if (type === 'text')  doc.body     = body;
    if (type === 'link')  doc.url      = url;
    if (type === 'image') doc.imageUrl = imageUrl;

    const post = await Post.create(doc);

    const populated = await Post.findById(post._id)
      .populate('author', 'username')
      .populate('community', 'name type');

    res.status(201).json({
      success: true,
      message: 'Post created successfully',
      post: populated,
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ success: false, message: messages[0] });
    }
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// ─── @route  GET /reddit/posts/:id ───────────────────────────────────────────
// ─── @access Public (private communities: members only) ──────────────────────
const getPost = async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id))
    return res.status(404).json({ success: false, message: 'Post not found' });

  try {
    const post = await Post.findById(id)
      .populate('author', 'username')
      .populate('community', 'name type');

    // 404 for missing posts AND for posts we aren't allowed to see — don't leak existence
    if (!post)
      return res.status(404).json({ success: false, message: 'Post not found' });

    const community = post.community;
    const userId = req.user ? req.user.id : null;

    if (!(await canUserViewPostInCommunity(community, userId)))
      return res.status(404).json({ success: false, message: 'Post not found' });

    // Soft-deleted posts still respond 200 with a redacted body (toJSON handles the redaction).
    // This mirrors Reddit: a deleted post's URL still works but the content is gone.
    res.status(200).json({ success: true, post });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// ─── @route  GET /reddit/posts/community/:name ───────────────────────────────
// ─── @access Public (private communities: members only) ──────────────────────
const listPostsByCommunity = async (req, res) => {
  const { name } = req.params;
  const userId = req.user ? req.user.id : null;

  // Sanitise paging params — never trust query strings
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, parseInt(req.query.limit, 10) || DEFAULT_PAGE_SIZE),
  );
  const skip = (page - 1) * limit;

  try {
    const { community } = await findViewableCommunity(name, userId);
    if (!community)
      return res.status(404).json({ success: false, message: 'Community not found' });

    // Exclude soft-deleted posts from the list view (they're still fetchable by id)
    const filter = { community: community._id, isDeleted: false };

    const [posts, total] = await Promise.all([
      Post.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('author', 'username')
        .populate('community', 'name type'),
      Post.countDocuments(filter),
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

// ─── @route  PATCH /reddit/posts/:id ─────────────────────────────────────────
// ─── @access Private (author only) ───────────────────────────────────────────
const updatePost = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ success: false, errors: errors.array() });

  const { id } = req.params;
  if (!isValidObjectId(id))
    return res.status(404).json({ success: false, message: 'Post not found' });

  try {
    const post = await Post.findById(id);
    if (!post || post.isDeleted)
      return res.status(404).json({ success: false, message: 'Post not found' });

    if (!post.author.equals(req.user.id))
      return res.status(403).json({ success: false, message: 'You can only edit your own posts' });

    const community = await Community.findById(post.community);
    if (community && community.isArchived)
      return res.status(403).json({ success: false, message: 'This community is archived and posts cannot be edited' });

    // Only let the author touch the content fields relevant to the post type.
    // Title is universal; the rest is type-scoped so a text post can't suddenly grow a url.
    const { title, body, url, imageUrl } = req.body;

    if (typeof title === 'string') post.title = title;

    if (post.type === 'text' && typeof body === 'string') {
      post.body = body;
    } else if (post.type === 'link' && typeof url === 'string') {
      post.url = url;
    } else if (post.type === 'image' && typeof imageUrl === 'string') {
      post.imageUrl = imageUrl;
    }

    await post.save();

    const populated = await Post.findById(post._id)
      .populate('author', 'username')
      .populate('community', 'name type');

    res.status(200).json({
      success: true,
      message: 'Post updated successfully',
      post: populated,
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ success: false, message: messages[0] });
    }
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// ─── @route  DELETE /reddit/posts/:id ────────────────────────────────────────
// ─── @access Private (author only) ───────────────────────────────────────────
const deletePost = async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id))
    return res.status(404).json({ success: false, message: 'Post not found' });

  try {
    const post = await Post.findById(id);
    if (!post || post.isDeleted)
      return res.status(404).json({ success: false, message: 'Post not found' });

    if (!post.author.equals(req.user.id))
      return res.status(403).json({ success: false, message: 'You can only delete your own posts' });

    // Soft delete — keeps the doc so future comments / vote counts remain consistent
    post.isDeleted = true;
    post.deletedAt = new Date();
    await post.save();

    res.status(200).json({ success: true, message: 'Post deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

module.exports = {
  createPost,
  getPost,
  listPostsByCommunity,
  updatePost,
  deletePost,
};
