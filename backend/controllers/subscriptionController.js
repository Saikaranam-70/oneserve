const Razorpay = require('razorpay');
const crypto = require('crypto');
const Business = require('../models/Business');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const PLANS = {
  basic: { amount: 49900, name: 'OneServe Basic', description: 'Up to 100 orders/month' },
  pro:   { amount: 99900, name: 'OneServe Pro',   description: 'Unlimited orders + analytics' },
};

// GET /api/subscription/plans
const getPlans = (req, res) => {
  res.json({
    success: true,
    plans: [
      { id: 'free',  name: 'Free',  price: 0,     orders: 20,         features: ['20 orders/month', 'Basic bot', '1 WhatsApp number'] },
      { id: 'basic', name: 'Basic', price: 499,   orders: 100,        features: ['100 orders/month', 'Full bot', 'Analytics', 'CSV export'] },
      { id: 'pro',   name: 'Pro',   price: 999,   orders: 'Unlimited', features: ['Unlimited orders', 'Priority support', 'Custom messages', 'All analytics'] },
    ],
  });
};

// POST /api/subscription/create-order
const createOrder = async (req, res, next) => {
  try {
    const { plan } = req.body;
    if (!PLANS[plan]) return res.status(400).json({ success: false, message: 'Invalid plan' });

    const order = await razorpay.orders.create({
      amount: PLANS[plan].amount,
      currency: 'INR',
      receipt: `sub_${req.business._id}_${Date.now()}`,
      notes: { businessId: req.business._id.toString(), plan },
    });

    res.json({ success: true, order, key: process.env.RAZORPAY_KEY_ID });
  } catch (err) {
    next(err);
  }
};

// POST /api/subscription/verify
const verifyPayment = async (req, res, next) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan } = req.body;

    const expectedSig = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSig !== razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Payment verification failed' });
    }

    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 1);

    await Business.findByIdAndUpdate(req.business._id, {
      plan,
      planExpiresAt: expiresAt,
    });

    res.json({ success: true, message: `Upgraded to ${plan} plan successfully!`, plan, expiresAt });
  } catch (err) {
    next(err);
  }
};

module.exports = { getPlans, createOrder, verifyPayment };
