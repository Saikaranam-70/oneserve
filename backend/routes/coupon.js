const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getCoupons,
  createCoupon,
  toggleCoupon,
  deleteCoupon
} = require('../controllers/couponController');

router.use(protect);

router.route('/')
  .get(getCoupons)
  .post(createCoupon);

router.route('/:id')
  .patch(toggleCoupon)
  .delete(deleteCoupon);

module.exports = router;
