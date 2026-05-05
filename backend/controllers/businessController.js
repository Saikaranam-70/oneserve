const Business = require('../models/Business');
const { cloudinary } = require('../config/cloudinary');
const multer = require('multer');

const logoStorageEngine = {
  _handleFile(req, file, cb) {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Only image files allowed'));
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: 'oneserve/logos', transformation: [{ width: 400, height: 400, crop: 'fill' }] },
      (error, result) => {
        if (error) return cb(error);
        cb(null, { path: result.secure_url, filename: result.public_id });
      }
    );
    file.stream.pipe(uploadStream);
  },
  _removeFile(req, file, cb) { cloudinary.uploader.destroy(file.filename, cb); },
};
const uploadLogo = multer({ storage: logoStorageEngine, limits: { fileSize: 2 * 1024 * 1024 } });

// GET /api/business/profile
const getProfile = async (req, res) => {
  res.json({ success: true, business: req.business });
};

// PATCH /api/business/profile
const updateProfile = async (req, res, next) => {
  try {
    const allowed = ['name', 'phone', 'address', 'category'];
    const updates = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    if (req.file) updates.logo = req.file.path;

    const business = await Business.findByIdAndUpdate(req.business._id, updates, { new: true, runValidators: true });
    res.json({ success: true, message: 'Profile updated', business });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/business/settings
const updateSettings = async (req, res, next) => {
  try {
    const { orderConfirmationMessage, orderReadyMessage, welcomeMessage, currency, autoConfirm } = req.body;
    const business = await Business.findById(req.business._id);

    if (orderConfirmationMessage !== undefined) business.settings.orderConfirmationMessage = orderConfirmationMessage;
    if (orderReadyMessage !== undefined) business.settings.orderReadyMessage = orderReadyMessage;
    if (welcomeMessage !== undefined) business.settings.welcomeMessage = welcomeMessage;
    if (currency !== undefined) business.settings.currency = currency;
    if (autoConfirm !== undefined) business.settings.autoConfirm = autoConfirm;

    await business.save();
    res.json({ success: true, message: 'Settings updated', settings: business.settings });
  } catch (err) {
    next(err);
  }
};

module.exports = { getProfile, updateProfile, updateSettings, uploadLogo };
