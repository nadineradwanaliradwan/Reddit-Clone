const jwt = require('jsonwebtoken');
const User = require('../Models/authModel');

// ─── Protect: Verify access token ────────────────────────────────────────────
const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer '))
    return res.status(401).json({ success: false, message: 'Access denied. No token provided' });

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Select passwordChangedAt to detect post-issue password changes
    const user = await User.findById(decoded.id).select('+passwordChangedAt');

    if (!user)
      return res.status(401).json({ success: false, message: 'User no longer exists' });

    if (!user.isActive)
      return res.status(403).json({ success: false, message: 'Account is deactivated' });

    // Reject tokens issued before the last password change
    if (user.changedPasswordAfter(decoded.iat))
      return res.status(401).json({
        success: false,
        message: 'Password was recently changed. Please log in again',
      });

    req.user = { id: user._id, role: user.role };
    next();
  } catch (err) {
    const message = err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token';
    res.status(401).json({ success: false, message });
  }
};

// ─── RestrictTo: Role-based access control ───────────────────────────────────
// Usage: restrictTo('admin') or restrictTo('admin', 'moderator')
const restrictTo = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role))
    return res.status(403).json({
      success: false,
      message: `Access denied. Required role: ${roles.join(' or ')}`,
    });
  next();
};

module.exports = { protect, restrictTo };
