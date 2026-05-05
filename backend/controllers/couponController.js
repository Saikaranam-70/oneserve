const Coupon = require('../models/Coupon');

// GET /api/coupons
const getCoupons = async (req, res, next) => {
  try {
    const coupons = await Coupon.find({ business: req.business._id }).sort({ createdAt: -1 });
    res.json({ success: true, coupons });
  } catch (err) {
    next(err);
  }
};

// POST /api/coupons
const createCoupon = async (req, res, next) => {
  try {
    const { code, discountType, discountValue, minOrderValue, maxDiscount } = req.body;
    
    if (!code || !discountValue) {
      return res.status(400).json({ success: false, message: 'Code and Discount Value are required' });
    }

    const existing = await Coupon.findOne({ business: req.business._id, code: code.toUpperCase() });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Coupon code already exists' });
    }

    const coupon = await Coupon.create({
      business: req.business._id,
      code: code.toUpperCase(),
      discountType,
      discountValue: Number(discountValue),
      minOrderValue: Number(minOrderValue) || 0,
      maxDiscount: maxDiscount ? Number(maxDiscount) : undefined,
    });

    res.status(201).json({ success: true, coupon });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/coupons/:id
const toggleCoupon = async (req, res, next) => {
  try {
    const coupon = await Coupon.findOne({ _id: req.params.id, business: req.business._id });
    if (!coupon) return res.status(404).json({ success: false, message: 'Coupon not found' });

    coupon.isActive = !coupon.isActive;
    await coupon.save();

    res.json({ success: true, coupon });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/coupons/:id
const deleteCoupon = async (req, res, next) => {
  try {
    const coupon = await Coupon.findOneAndDelete({ _id: req.params.id, business: req.business._id });
    if (!coupon) return res.status(404).json({ success: false, message: 'Coupon not found' });
    res.json({ success: true, message: 'Coupon deleted' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getCoupons,
  createCoupon,
  toggleCoupon,
  deleteCoupon,
};
