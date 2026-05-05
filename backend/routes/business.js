const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getProfile, updateProfile, updateSettings, uploadLogo } = require('../controllers/businessController');

router.use(protect);
router.get('/profile', getProfile);
router.patch('/profile', uploadLogo.single('logo'), updateProfile);
router.patch('/settings', updateSettings);

module.exports = router;
