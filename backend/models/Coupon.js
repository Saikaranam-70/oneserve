const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
  code: { type: String, required: true, uppercase: true, trim: true },
  discountType: { type: String, enum: ['percentage', 'flat'], default: 'percentage' },
  discountValue: { type: Number, required: true },
  minOrderValue: { type: Number, default: 0 },
  maxDiscount: { type: Number },
  isActive: { type: Boolean, default: true },
  usedCount: { type: Number, default: 0 },
}, { timestamps: true });

couponSchema.index({ business: 1, code: 1 }, { unique: true });

module.exports = mongoose.model('Coupon', couponSchema);
