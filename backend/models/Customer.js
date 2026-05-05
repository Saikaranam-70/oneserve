const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
  waId: { type: String, required: true },
  name: { type: String, default: '' },
  phone: { type: String, required: true },
  totalOrders: { type: Number, default: 0 },
  totalSpent: { type: Number, default: 0 },
  lastOrderAt: { type: Date },

  // Conversation state machine
  conversationState: {
    step: {
      type: String,
      enum: ['idle', 'browsing', 'cart', 'checkout', 'awaiting_address', 'awaiting_confirm'],
      default: 'idle',
    },
    cart: [{
      productId: mongoose.Schema.Types.ObjectId,
      name: String,
      price: Number,
      quantity: Number,
    }],
    pendingOrderId: String,
    lastActivity: { type: Date, default: Date.now },
  },

  isBlocked: { type: Boolean, default: false },
}, { timestamps: true });

customerSchema.index({ business: 1, waId: 1 }, { unique: true });

module.exports = mongoose.model('Customer', customerSchema);
