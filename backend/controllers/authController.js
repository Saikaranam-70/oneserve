const jwt = require('jsonwebtoken');
const Business = require('../models/Business');
const { redis } = require('../config/rediss');

const generateTokens = (id) => {
  const accessToken = jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
  const refreshToken = jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  });
  return { accessToken, refreshToken };
};

// POST /api/auth/register
const register = async (req, res, next) => {
  try {
    const { name, email, password, phone, category } = req.body;

    if (!name || !email || !password || !phone) {
      return res.status(400).json({ success: false, message: 'All fields required' });
    }

    const existing = await Business.findOne({ email });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    const business = await Business.create({ name, email, password, phone, category });
    const { accessToken, refreshToken } = generateTokens(business._id);

    business.refreshToken = refreshToken;
    await business.save({ validateBeforeSave: false });

    res.status(201).json({
      success: true,
      message: 'Registered successfully',
      accessToken,
      refreshToken,
      business,
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/login
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password required' });
    }

    const business = await Business.findOne({ email }).select('+password');
    if (!business || !(await business.matchPassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (!business.isActive) {
      return res.status(403).json({ success: false, message: 'Account deactivated' });
    }

    const { accessToken, refreshToken } = generateTokens(business._id);
    business.refreshToken = refreshToken;
    await business.save({ validateBeforeSave: false });

    res.json({
      success: true,
      message: 'Login successful',
      accessToken,
      refreshToken,
      business,
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/refresh
const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ success: false, message: 'Refresh token required' });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const business = await Business.findById(decoded.id);

    if (!business || business.refreshToken !== refreshToken) {
      return res.status(401).json({ success: false, message: 'Invalid refresh token' });
    }

    const { accessToken, refreshToken: newRefresh } = generateTokens(business._id);
    business.refreshToken = newRefresh;
    await business.save({ validateBeforeSave: false });

    res.json({ success: true, accessToken, refreshToken: newRefresh });
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Refresh token expired, please login again' });
    }
    next(err);
  }
};

// POST /api/auth/logout
const logout = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      // const redis = getRedis();
      // Blacklist token for remaining TTL
      const decoded = jwt.decode(token);
      const ttl = decoded.exp - Math.floor(Date.now() / 1000);
      if (ttl > 0) await redis.setex(`blacklist:${token}`, ttl, '1');
    }

    const business = await Business.findById(req.business._id);
    if (business) {
      business.refreshToken = null;
      await business.save({ validateBeforeSave: false });
    }

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
};

// GET /api/auth/me
const getMe = async (req, res) => {
  res.json({ success: true, business: req.business });
};

// PATCH /api/auth/change-password
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const business = await Business.findById(req.business._id).select('+password');

    if (!(await business.matchPassword(currentPassword))) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }

    business.password = newPassword;
    await business.save();

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, refresh, logout, getMe, changePassword };
