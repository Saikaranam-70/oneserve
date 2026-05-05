const Order = require('../models/Order');
const Customer = require('../models/Customer');
const { redis } = require('../config/rediss');
const { sendWhatsAppMessage } = require('../services/whatsappService');
const { v4: uuidv4 } = require('uuid');

const generateOrderId = () => `ORD-${Date.now().toString(36).toUpperCase()}-${uuidv4().slice(0, 4).toUpperCase()}`;

// GET /api/orders
const getOrders = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20, search, from, to } = req.query;
    const filter = { business: req.business._id };

    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { orderId: { $regex: search, $options: 'i' } },
        { 'customer.name': { $regex: search, $options: 'i' } },
        { 'customer.phone': { $regex: search, $options: 'i' } },
      ];
    }
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [orders, total] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      Order.countDocuments(filter),
    ]);

    res.json({ success: true, orders, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    next(err);
  }
};

// GET /api/orders/:id
const getOrder = async (req, res, next) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, business: req.business._id })
      .populate('items.product', 'name images');
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    res.json({ success: true, order });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/orders/:id/status
const updateOrderStatus = async (req, res, next) => {
  try {
    const { status, note } = req.body;
    const validStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const order = await Order.findOne({ _id: req.params.id, business: req.business._id });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    order.status = status;
    order.statusHistory.push({ status, note: note || '' });
    await order.save();

    // Send WhatsApp notification based on status
    const business = req.business;
    const settings = business.settings || {};
    let message = null;

    if (status === 'confirmed') {
      const defaultMsg = `✅ Great news! Your order {orderId} has been confirmed.`;
      message = (settings.orderConfirmationMessage || defaultMsg).replace('{orderId}', order.orderId);
    } else if (status === 'preparing') {
      message = `🍳 Your order ${order.orderId} is now being prepared!`;
    } else if (status === 'ready') {
      const defaultMsg = `📦 Your order {orderId} is ready!`;
      message = (settings.orderReadyMessage || defaultMsg).replace('{orderId}', order.orderId);
    } else if (status === 'delivered') {
      message = `🎉 Your order ${order.orderId} has been delivered/picked up. Thank you for shopping with us!`;
    } else if (status === 'cancelled') {
      message = `❌ Your order ${order.orderId} has been cancelled. ${note ? `Reason: ${note}` : ''}`;
    }

    if (message) {
      await sendWhatsAppMessage(business, order.customer.waId, message).catch(console.error);
    }

    // Invalidate order cache
    // const redis = getRedis();
    await redis.del(`orders:${business._id}:stats`);

    res.json({ success: true, message: 'Status updated', order });
  } catch (err) {
    next(err);
  }
};

// GET /api/orders/counts - for kanban
const getOrderCounts = async (req, res, next) => {
  try {
    const businessId = req.business._id;
    // const redis = getRedis();
    const cacheKey = `orders:${businessId}:counts`;

    const cached = await redis.get(cacheKey);
    if (cached) {
      const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached;
      return res.json({ success: true, counts: parsed });
    }

    const counts = await Order.aggregate([
      { $match: { business: businessId } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const result = {};
    counts.forEach(c => { result[c._id] = c.count; });
    await redis.setex(cacheKey, 60, JSON.stringify(result));

    res.json({ success: true, counts: result });
  } catch (err) {
    next(err);
  }
};

// POST /api/orders (manual order creation from dashboard)
const createOrder = async (req, res, next) => {
  try {
    const { customer, items, deliveryType, deliveryAddress, notes } = req.body;

    if (!customer?.phone || !items?.length) {
      return res.status(400).json({ success: false, message: 'Customer phone and items required' });
    }

    const subtotal = items.reduce((sum, i) => sum + (i.price * i.quantity), 0);
    const total = subtotal + (req.body.tax || 0) + (req.body.deliveryCharge || 0);

    const order = await Order.create({
      business: req.business._id,
      orderId: generateOrderId(),
      customer: { ...customer, waId: customer.phone },
      items: items.map(i => ({ ...i, total: i.price * i.quantity })),
      subtotal, total,
      deliveryType: deliveryType || 'pickup',
      deliveryAddress: deliveryAddress || '',
      notes: notes || '',
      statusHistory: [{ status: 'pending' }],
    });

    res.status(201).json({ success: true, message: 'Order created', order });
  } catch (err) {
    next(err);
  }
};

module.exports = { getOrders, getOrder, updateOrderStatus, getOrderCounts, createOrder };
