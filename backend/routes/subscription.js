const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getPlans, createOrder, verifyPayment } = require('../controllers/subscriptionController');

router.get('/plans', getPlans);
router.use(protect);
router.post('/create-order', createOrder);
router.post('/verify', verifyPayment);

module.exports = router;
