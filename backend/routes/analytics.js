const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getDashboard, getRevenue, getTopProducts, getOrdersByStatus, exportOrders } = require('../controllers/analyticsController');

router.use(protect);
router.get('/dashboard', getDashboard);
router.get('/revenue', getRevenue);
router.get('/top-products', getTopProducts);
router.get('/orders-by-status', getOrdersByStatus);
router.get('/export', exportOrders);

module.exports = router;
