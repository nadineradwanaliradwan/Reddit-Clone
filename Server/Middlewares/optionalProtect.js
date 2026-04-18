const jwt = require('jsonwebtoken');
const User = require('../Models/authModel');

// Like protect, but never blocks the request — sets req.user to null if no/invalid token
const optionalProtect = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('+passwordChangedAt');

    if (!user || !user.isActive || user.changedPasswordAfter(decoded.iat)) {
      req.user = null;
    } else {
      req.user = { id: user._id, role: user.role };
    }
  } catch {
    req.user = null;
  }

  next();
};

module.exports = { optionalProtect };
