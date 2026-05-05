const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const businessSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 6 },
  phone: { type: String, required: true },
  logo: { type: String, default: '' },
  address: { type: String, default: '' },
  category: {
    type: String,
    enum: ['restaurant', 'grocery', 'fashion', 'electronics', 'pharmacy', 'bakery', 'other'],
    default: 'other',
  },

  // WhatsApp connection
  whatsapp: {
    method: { type: String, enum: ['meta', 'baileys', 'wppconnect', null], default: null },
    connected: { type: Boolean, default: false },
    phoneNumber: { type: String, default: '' },
    sessionId: { type: String, default: '' },
    metaPhoneNumberId: { type: String, default: '' },
    metaToken: { type: String, default: '' },
    connectedAt: { type: Date },
  },

  // Subscription
  plan: { type: String, enum: ['free', 'basic', 'pro'], default: 'free' },
  planExpiresAt: { type: Date },
  razorpayCustomerId: { type: String, default: '' },
  razorpaySubscriptionId: { type: String, default: '' },

  // Settings
  settings: {
    orderConfirmationMessage: {
      type: String,
      default: 'Thank you for your order! Your order #{orderId} has been placed successfully.',
    },
    orderReadyMessage: {
      type: String,
      default: 'Your order #{orderId} is ready! Please come and collect it.',
    },
    welcomeMessage: {
      type: String,
      default: 'Welcome! Reply with *menu* to see our products or *order* to place an order.',
    },
    currency: { type: String, default: 'INR' },
    deliveryFee: { type: Number, default: 30 },
    autoConfirm: { type: Boolean, default: false },
  },

  isActive: { type: Boolean, default: true },
  refreshToken: { type: String },
}, { timestamps: true });

// Hash password before save
businessSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

businessSchema.methods.matchPassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

businessSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.refreshToken;
  delete obj.whatsapp.metaToken;
  return obj;
};

module.exports = mongoose.model('Business', businessSchema);
