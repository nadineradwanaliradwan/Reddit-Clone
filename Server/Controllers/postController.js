const mongoose = require('mongoose');
const { validationResult } = require('express-validator');
const Post = require('../Models/postModel');
const Community = require('../Models/communityModel');
const Membership = require('../Models/membershipModel');
const SavedPost = require('../Models/savedPostModel');

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE     = 50;

// Time-range filter windows, in milliseconds. 'all' is absent on purpose —
// it means "no time filter at all".
const TIME_RANGE_MS = {
  hour:  60 * 60 * 1000,
  day:   24 * 60 * 60 * 1000,
  week:   7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
  year: 365 * 24 * 60 * 60 * 1000,
};

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

// A flair is only valid for a post if the community defines one with that id.
// Returns true when `flairId` is falsy (no flair chosen) or when it matches a
// subdoc in community.flairs.
const isFlairValidForCommunity = (community, flairId) => {
  if (!flairId) return true;
  if (!isValidObjectId(flairId)) return false;
  return community.flairs.some(f => f._id.equals(flairId));
};

// ─── @route  POST /reddit/posts ──────────────────────────────────────────────
// ─── @access Private ─────────────────────────────────────────────────────────
const createPost = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ success: false, errors: errors.array() });

  const { community: communityName, type, title, body, url, imageUrl, flair } = req.body;

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

    // Flair is optional — reject only if one was supplied and it doesn't belong to this community
    if (flair && !isFlairValidForCommunity(community, flair))
      return res.status(400).json({ success: false, message: 'Invalid flair for this community' });

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
    if (flair)            doc.flair    = flair;

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
// ─── @query  page, limit, sort (new|old), type, flair, t ─────────────────────
//
// Filters (all optional):
//   type   — 'text' | 'link' | 'image'                              — post type
//   flair  — <flairId> | 'none'                                     — specific flair, or only unflaired
//   t      — 'hour' | 'day' | 'week' | 'month' | 'year' | 'all'     — time window (default 'all')
//
// Invalid filter values are rejected with 400 rather than silently ignored — clients
// shouldn't receive a different result set than the one they asked for without knowing.
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

  // sort=new (default) → newest first; sort=old → oldest first
  const VALID_SORTS = ['new', 'old'];
  const sortParam = VALID_SORTS.includes(req.query.sort) ? req.query.sort : 'new';
  const sortOrder = sortParam === 'old' ? 1 : -1;

  // ── Filter validation ─────────────────────────────────────────────────────
  // type — strict check, reject unknown values loudly
  if (req.query.type !== undefined && !Post.POST_TYPES.includes(req.query.type))
    return res.status(400).json({
      success: false,
      message: `type must be one of ${Post.POST_TYPES.join(', ')}`,
    });
  const typeFilter = req.query.type || null;

  // flair — 'none' means "no flair", otherwise must be a real ObjectId.
  // Whether that id actually belongs to the community is checked below, once we have the community.
  const rawFlair = req.query.flair;
  if (rawFlair !== undefined && rawFlair !== 'none' && !isValidObjectId(rawFlair))
    return res.status(400).json({ success: false, message: 'flair must be a valid id or "none"' });
  const flairFilter = rawFlair || null;

  // t — time window. 'all' (or missing) means "no time filter".
  const rawTime = req.query.t;
  const timeKey = rawTime === undefined || rawTime === 'all' ? null : rawTime;
  if (timeKey && !Object.prototype.hasOwnProperty.call(TIME_RANGE_MS, timeKey))
    return res.status(400).json({
      success: false,
      message: `t must be one of ${Object.keys(TIME_RANGE_MS).join(', ')}, or 'all'`,
    });

  try {
    const { community } = await findViewableCommunity(name, userId);
    if (!community)
      return res.status(404).json({ success: false, message: 'Community not found' });

    // A specific flair id must belong to this community; otherwise it's always an empty result.
    // Return 400 instead of an empty list so the client knows their filter is wrong.
    if (flairFilter && flairFilter !== 'none' && !isFlairValidForCommunity(community, flairFilter))
      return res.status(400).json({ success: false, message: 'Unknown flair for this community' });

    // Exclude soft-deleted posts from the list view (they're still fetchable by id)
    const filter = { community: community._id, isDeleted: false };
    if (typeFilter) filter.type = typeFilter;

    if (flairFilter === 'none')   filter.flair = null;
    else if (flairFilter)         filter.flair = flairFilter;

    if (timeKey) {
      filter.createdAt = { $gte: new Date(Date.now() - TIME_RANGE_MS[timeKey]) };
    }

    const [posts, total, membership] = await Promise.all([
      Post.find(filter)
        .sort({ createdAt: sortOrder })
        .skip(skip)
        .limit(limit)
        .populate('author', 'username')
        .populate('community', 'name type'),
      Post.countDocuments(filter),
      userId ? Membership.findOne({ user: userId, community: community._id }) : Promise.resolve(null),
    ]);

    res.status(200).json({
      success: true,
      community: {
        name: community.name,
        description: community.description,
        type: community.type,
        memberCount: community.memberCount,
        icon: community.icon,
        banner: community.banner,
        isNSFW: community.isNSFW,
        isArchived: community.isArchived,
        allowedPostTypes: community.allowedPostTypes,
        flairs: community.flairs, // surfaced so clients can build a flair-filter UI
        createdAt: community.createdAt,
      },
      isMember: !!membership,
      memberRole: membership ? membership.role : null,
      sort: sortParam,
      typeFilter,
      flairFilter,
      timeFilter: timeKey || 'all',
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
    const { title, body, url, imageUrl, flair } = req.body;

    if (typeof title === 'string') post.title = title;

    if (post.type === 'text' && typeof body === 'string') {
      post.body = body;
    } else if (post.type === 'link' && typeof url === 'string') {
      post.url = url;
    } else if (post.type === 'image' && typeof imageUrl === 'string') {
      post.imageUrl = imageUrl;
    }

    // Flair is optional — `null` / '' clears it, a valid id sets it, anything else is rejected.
    // We compare against the post's community so you can't "steal" a flair from another community.
    if (flair === null || flair === '') {
      post.flair = null;
    } else if (typeof flair === 'string') {
      if (!community || !isFlairValidForCommunity(community, flair))
        return res.status(400).json({ success: false, message: 'Invalid flair for this community' });
      post.flair = flair;
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

// ─── @route  GET /reddit/posts/feed ──────────────────────────────────────────
// ─── @access Public for `popular`, Private for `home` and `saved` ────────────
// ─── @query  scope, page, limit, sort (new|old), type, flair, t ──────────────
//
// Single endpoint serving three feed scopes:
//   home    — posts from communities the logged-in user has joined.
//             Requires auth. Returns an empty list if the user is in zero communities.
//   popular — posts from every PUBLIC community. Anonymous-friendly.
//   saved   — posts the logged-in user has saved (via POST /:id/save).
//             Requires auth. Sorted by save time, not post-creation time, so the
//             newest *save* shows first regardless of the post's age.
//
// All three reuse the same filter contract as listPostsByCommunity:
//   type, flair (+ 'none'), t (time window). Invalid filter values → 400.
//
// Note on `flair` across communities: a flair id is community-scoped. We accept
// it because the user explicitly asked for it — passing one will just narrow the
// feed to posts in the single community that owns that flair id. 'none' returns
// every unflaired post in the feed scope, which is broadly useful.
const listFeed = async (req, res) => {
  const userId = req.user ? req.user.id : null;

  // ── scope ─────────────────────────────────────────────────────────────────
  const VALID_SCOPES = ['home', 'popular', 'saved'];
  const scope = VALID_SCOPES.includes(req.query.scope) ? req.query.scope : 'popular';
  if ((scope === 'home' || scope === 'saved') && !userId)
    return res.status(401).json({
      success: false,
      message: `Authentication required for the '${scope}' feed`,
    });

  // ── paging ────────────────────────────────────────────────────────────────
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, parseInt(req.query.limit, 10) || DEFAULT_PAGE_SIZE),
  );
  const skip = (page - 1) * limit;

  // ── sort ──────────────────────────────────────────────────────────────────
  const VALID_SORTS = ['new', 'old'];
  const sortParam = VALID_SORTS.includes(req.query.sort) ? req.query.sort : 'new';
  const sortOrder = sortParam === 'old' ? 1 : -1;

  // ── filter validation (mirrors listPostsByCommunity) ──────────────────────
  if (req.query.type !== undefined && !Post.POST_TYPES.includes(req.query.type))
    return res.status(400).json({
      success: false,
      message: `type must be one of ${Post.POST_TYPES.join(', ')}`,
    });
  const typeFilter = req.query.type || null;

  const rawFlair = req.query.flair;
  if (rawFlair !== undefined && rawFlair !== 'none' && !isValidObjectId(rawFlair))
    return res.status(400).json({ success: false, message: 'flair must be a valid id or "none"' });
  const flairFilter = rawFlair || null;

  const rawTime = req.query.t;
  const timeKey = rawTime === undefined || rawTime === 'all' ? null : rawTime;
  if (timeKey && !Object.prototype.hasOwnProperty.call(TIME_RANGE_MS, timeKey))
    return res.status(400).json({
      success: false,
      message: `t must be one of ${Object.keys(TIME_RANGE_MS).join(', ')}, or 'all'`,
    });

  try {
    // Base filter — exclude soft-deleted posts from every feed
    const filter = { isDeleted: false };
    if (typeFilter) filter.type = typeFilter;
    if (flairFilter === 'none')   filter.flair = null;
    else if (flairFilter)         filter.flair = flairFilter;
    if (timeKey)
      filter.createdAt = { $gte: new Date(Date.now() - TIME_RANGE_MS[timeKey]) };

    // ── scope-specific narrowing ────────────────────────────────────────────
    // For 'saved' we keep the SavedPost docs around so we can sort by savedAt
    // *after* fetching the matching posts.
    let savedDocsForOrdering = null;

    if (scope === 'home') {
      const memberships = await Membership.find({ user: userId }).select('community');
      const communityIds = memberships.map(m => m.community);
      // Empty membership list → empty feed (don't even hit the Post collection)
      if (communityIds.length === 0)
        return res.status(200).json(emptyFeedResponse({ scope, sortParam, typeFilter, flairFilter, timeKey, page, limit }));
      filter.community = { $in: communityIds };

    } else if (scope === 'popular') {
      // Anon-safe: only posts in PUBLIC communities. Restricted/private are excluded
      // even for logged-in members, since 'popular' is meant to be the open firehose.
      const publics = await Community.find({ type: 'public' }).select('_id');
      filter.community = { $in: publics.map(c => c._id) };

    } else { // scope === 'saved'
      // Pull every save for this user — pre-sorted so we can preserve order later
      savedDocsForOrdering = await SavedPost.find({ user: userId })
        .select('post savedAt')
        .sort({ savedAt: sortOrder });
      const postIds = savedDocsForOrdering.map(s => s.post);
      if (postIds.length === 0)
        return res.status(200).json(emptyFeedResponse({ scope, sortParam, typeFilter, flairFilter, timeKey, page, limit }));
      filter._id = { $in: postIds };

      // Security: hide saves the user can no longer access (e.g. left a private community).
      // Keep posts whose community is public/restricted OR where the user is still a member.
      const memberCommunityIds = (
        await Membership.find({ user: userId }).select('community')
      ).map(m => m.community);
      const accessibleCommunityIds = (
        await Community.find({
          $or: [
            { type: { $in: ['public', 'restricted'] } },
            { _id: { $in: memberCommunityIds } },
          ],
        }).select('_id')
      ).map(c => c._id);
      filter.community = { $in: accessibleCommunityIds };
    }

    // ── fetch ────────────────────────────────────────────────────────────────
    const total = await Post.countDocuments(filter);

    let posts;
    if (scope === 'saved') {
      // Saved feed sorts by savedAt, not createdAt. Easiest approach: fetch all
      // matching posts (already narrowed by _id $in), then re-order in JS using
      // the pre-sorted savedDocsForOrdering, then paginate.
      const all = await Post.find(filter)
        .populate('author', 'username')
        .populate('community', 'name type');

      const byId = new Map(all.map(p => [String(p._id), p]));
      const ordered = savedDocsForOrdering
        .map(s => byId.get(String(s.post)))
        .filter(Boolean); // drop any saves whose posts got filtered out (deleted, type/flair/t mismatch, no access)

      posts = ordered.slice(skip, skip + limit);
    } else {
      posts = await Post.find(filter)
        .sort({ createdAt: sortOrder })
        .skip(skip)
        .limit(limit)
        .populate('author', 'username')
        .populate('community', 'name type');
    }

    res.status(200).json({
      success: true,
      scope,
      sort: sortParam,
      typeFilter,
      flairFilter,
      timeFilter: timeKey || 'all',
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

// Helper — empty feed response that still echoes back the active filters so the
// client doesn't have to re-derive what was applied.
const emptyFeedResponse = ({ scope, sortParam, typeFilter, flairFilter, timeKey, page, limit }) => ({
  success: true,
  scope,
  sort: sortParam,
  typeFilter,
  flairFilter,
  timeFilter: timeKey || 'all',
  page,
  limit,
  total: 0,
  totalPages: 0,
  posts: [],
});

// ─── @route  POST /reddit/posts/:id/save ─────────────────────────────────────
// ─── @access Private ─────────────────────────────────────────────────────────
//
// Saves a post for the logged-in user. Idempotent: re-saving an already-saved
// post returns 200 with `alreadySaved: true` rather than 409 — matches Reddit's
// behavior and keeps clients from having to track local state.
const savePost = async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id))
    return res.status(404).json({ success: false, message: 'Post not found' });

  try {
    const post = await Post.findById(id).populate('community', 'type');
    if (!post || post.isDeleted)
      return res.status(404).json({ success: false, message: 'Post not found' });

    // Don't let users save posts they aren't allowed to view in the first place
    if (!(await canUserViewPostInCommunity(post.community, req.user.id)))
      return res.status(404).json({ success: false, message: 'Post not found' });

    try {
      await SavedPost.create({ user: req.user.id, post: post._id });
      return res.status(201).json({ success: true, message: 'Post saved' });
    } catch (err) {
      // Duplicate key on (user, post) — already saved; treat as success
      if (err.code === 11000)
        return res.status(200).json({ success: true, message: 'Post already saved', alreadySaved: true });
      throw err;
    }
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// ─── @route  DELETE /reddit/posts/:id/save ───────────────────────────────────
// ─── @access Private ─────────────────────────────────────────────────────────
//
// Unsaves a post for the logged-in user. Idempotent: unsaving a post that
// wasn't saved returns 200 with `alreadyUnsaved: true`.
const unsavePost = async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id))
    return res.status(404).json({ success: false, message: 'Post not found' });

  try {
    const result = await SavedPost.deleteOne({ user: req.user.id, post: id });
    if (result.deletedCount === 0)
      return res.status(200).json({ success: true, message: 'Post was not saved', alreadyUnsaved: true });
    res.status(200).json({ success: true, message: 'Post unsaved' });
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
  listFeed,
  savePost,
  unsavePost,
};