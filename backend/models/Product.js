const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  price: { type: Number, required: true, min: 0 },
  discountPrice: { type: Number, default: null },
  category: { type: String, default: 'General', trim: true },
  images: [{ url: String, publicId: String }],
  isAvailable: { type: Boolean, default: true },
  stock: { type: Number, default: -1 }, // -1 = unlimited
  sku: { type: String, default: '' },
  tags: [String],
  sortOrder: { type: Number, default: 0 },
}, { timestamps: true });

productSchema.index({ business: 1, isAvailable: 1 });
productSchema.index({ business: 1, category: 1 });

productSchema.virtual('effectivePrice').get(function () {
  return this.discountPrice !== null ? this.discountPrice : this.price;
});

module.exports = mongoose.model('Product', productSchema);
