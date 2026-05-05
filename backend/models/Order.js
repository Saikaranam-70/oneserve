const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  name: String,
  price: Number,
  quantity: { type: Number, default: 1 },
  total: Number,
}, { _id: false });

const orderSchema = new mongoose.Schema({
  business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
  orderId: { type: String, required: true, unique: true },

  // Customer info (from WhatsApp)
  customer: {
    name: { type: String, default: 'Customer' },
    phone: { type: String, required: true },
    waId: { type: String, required: true }, // WhatsApp ID
  },

  items: [orderItemSchema],

  subtotal: { type: Number, required: true },
  tax: { type: Number, default: 0 },
  deliveryCharge: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  couponCode: { type: String, default: '' },
  total: { type: Number, required: true },

  status: {
    type: String,
    enum: ['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'],
    default: 'pending',
    index: true,
  },

  deliveryType: {
    type: String,
    enum: ['pickup', 'delivery'],
    default: 'pickup',
  },

  deliveryAddress: { type: String, default: '' },

  notes: { type: String, default: '' },

  // WA message tracking
  messageId: { type: String, default: '' },
  conversationId: { type: String, default: '' },

  // Payment
  paymentStatus: {
    type: String,
    enum: ['unpaid', 'paid', 'refunded'],
    default: 'unpaid',
  },
  paymentMethod: { type: String, default: '' },

  statusHistory: [{
    status: String,
    changedAt: { type: Date, default: Date.now },
    note: String,
  }],
}, { timestamps: true });

orderSchema.index({ business: 1, createdAt: -1 });
orderSchema.index({ 'customer.phone': 1 });
orderSchema.index({ status: 1, business: 1 });

module.exports = mongoose.model('Order', orderSchema);
