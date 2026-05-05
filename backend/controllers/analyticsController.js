const Order = require('../models/Order');
const Customer = require('../models/Customer');
const { redis } = require('../config/rediss');

// GET /api/analytics/dashboard
const getDashboard = async (req, res, next) => {
  try {
    const businessId = req.business._id;
    // const redis = getRedis();
    const cacheKey = `analytics:${businessId}:dashboard`;

    const cached = await redis.get(cacheKey);
    if (cached) {
      const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached;
      return res.json({ success: true, ...parsed, fromCache: true });
    }

    const now = new Date();
    const startOfToday = new Date(now.setHours(0, 0, 0, 0));
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const [
      todayOrders,
      monthOrders,
      lastMonthOrders,
      totalCustomers,
      pendingOrders,
      recentOrders,
      allTimeStats
    ] = await Promise.all([
      Order.aggregate([
        { $match: { business: businessId, createdAt: { $gte: startOfToday }, status: { $ne: 'cancelled' } } },
        { $group: { _id: null, count: { $sum: 1 }, revenue: { $sum: '$total' }, totalDiscount: { $sum: '$discount' } } },
      ]),
      Order.aggregate([
        { $match: { business: businessId, createdAt: { $gte: startOfMonth }, status: { $ne: 'cancelled' } } },
        { $group: { _id: null, count: { $sum: 1 }, revenue: { $sum: '$total' }, totalDiscount: { $sum: '$discount' } } },
      ]),
      Order.aggregate([
        { $match: { business: businessId, createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth }, status: { $ne: 'cancelled' } } },
        { $group: { _id: null, count: { $sum: 1 }, revenue: { $sum: '$total' } } },
      ]),
      Customer.countDocuments({ business: businessId }),
      Order.countDocuments({ business: businessId, status: { $in: ['pending', 'confirmed', 'preparing'] } }),
      Order.find({ business: businessId }).sort({ createdAt: -1 }).limit(5).select('orderId customer.name total status createdAt'),
      Order.aggregate([
        { $match: { business: businessId, status: { $ne: 'cancelled' } } },
        { $group: { _id: null, totalOrders: { $sum: 1 }, totalRevenue: { $sum: '$total' }, totalDiscountAllTime: { $sum: '$discount' } } },
      ])
    ]);

    const thisMonthRevenue = monthOrders[0]?.revenue || 0;
    const lastMonthRevenue = lastMonthOrders[0]?.revenue || 0;
    const revenueGrowth = lastMonthRevenue > 0
      ? (((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100).toFixed(1)
      : 0;

    const data = {
      today: {
        orders: todayOrders[0]?.count || 0,
        revenue: todayOrders[0]?.revenue || 0,
        discount: todayOrders[0]?.totalDiscount || 0,
      },
      thisMonth: {
        orders: monthOrders[0]?.count || 0,
        revenue: thisMonthRevenue,
        discount: monthOrders[0]?.totalDiscount || 0,
        revenueGrowth: parseFloat(revenueGrowth),
      },
      allTime: {
        aov: allTimeStats[0] ? (allTimeStats[0].totalRevenue / (allTimeStats[0].totalOrders || 1)) : 0,
        totalDiscount: allTimeStats[0]?.totalDiscountAllTime || 0,
      },
      totalCustomers,
      pendingOrders,
      recentOrders,
    };

    await redis.setex(cacheKey, 120, JSON.stringify(data));
    res.json({ success: true, ...data });
  } catch (err) {
    next(err);
  }
};

// GET /api/analytics/revenue?period=7d|30d|90d
const getRevenue = async (req, res, next) => {
  try {
    const businessId = req.business._id;
    const { period = '30d' } = req.query;
    const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;

    // const redis = getRedis();
    const cacheKey = `analytics:${businessId}:revenue:${period}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached;
      return res.json({ success: true, data: parsed });
    }

    const from = new Date();
    from.setDate(from.getDate() - days);

    const data = await Order.aggregate([
      {
        $match: {
          business: businessId,
          createdAt: { $gte: from },
          status: { $ne: 'cancelled' },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          orders: { $sum: 1 },
          revenue: { $sum: '$total' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    await redis.setex(cacheKey, 300, JSON.stringify(data));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// GET /api/analytics/top-products
const getTopProducts = async (req, res, next) => {
  try {
    const businessId = req.business._id;
    const { limit = 10 } = req.query;

    const data = await Order.aggregate([
      { $match: { business: businessId, status: { $ne: 'cancelled' } } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.name',
          totalQuantity: { $sum: '$items.quantity' },
          totalRevenue: { $sum: '$items.total' },
          orderCount: { $sum: 1 },
        },
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: parseInt(limit) },
    ]);

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// GET /api/analytics/orders-by-status
const getOrdersByStatus = async (req, res, next) => {
  try {
    const businessId = req.business._id;
    const data = await Order.aggregate([
      { $match: { business: businessId } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// GET /api/analytics/export?from=&to=
const exportOrders = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const filter = { business: req.business._id };
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }

    const orders = await Order.find(filter).sort({ createdAt: -1 }).lean();

    const csv = [
      'Order ID,Customer,Phone,Items,Total,Status,Date',
      ...orders.map(o =>
        `${o.orderId},"${o.customer.name}",${o.customer.phone},"${o.items.map(i => `${i.name}x${i.quantity}`).join('; ')}",${o.total},${o.status},${new Date(o.createdAt).toLocaleDateString()}`
      ),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="orders-${Date.now()}.csv"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
};

module.exports = { getDashboard, getRevenue, getTopProducts, getOrdersByStatus, exportOrders };
