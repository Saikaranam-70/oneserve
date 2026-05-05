const jwt = require('jsonwebtoken');
const Business = require('../models/Business');
// const { getRedis } = require('../config/redis');
const { redis } = require('../config/rediss');  // ✅ correct

const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }
    

    const token = authHeader.split(' ')[1];
    console.log(token);

    // Check if token is blacklisted in Redis
    // const redis = getRedis();
    const isBlacklisted = await redis.get(`blacklist:${token}`);
    if (isBlacklisted) {
      return res.status(401).json({ success: false, message: 'Token has been revoked' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const business = await Business.findById(decoded.id).select('-password -refreshToken');

    if (!business) {
      return res.status(401).json({ success: false, message: 'Business not found' });
    }
    if (!business.isActive) {
      return res.status(403).json({ success: false, message: 'Account deactivated' });
    }

    req.business = business;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    console.log(err);
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

const requirePlan = (...plans) => (req, res, next) => {
  if (!plans.includes(req.business.plan)) {
    return res.status(403).json({
      success: false,
      message: `This feature requires a ${plans.join(' or ')} plan`,
      code: 'UPGRADE_REQUIRED',
    });
  }
  next();
};

module.exports = { protect, requirePlan };
