// routes/order.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getOrders, getOrder, updateOrderStatus, getOrderCounts, createOrder } = require('../controllers/orderController');
router.use(protect);
router.get('/counts', getOrderCounts);
router.get('/', getOrders);
router.post('/', createOrder);
router.get('/:id', getOrder);
router.patch('/:id/status', updateOrderStatus);
module.exports = router;
