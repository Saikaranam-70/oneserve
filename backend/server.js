// const express = require('express');
// const cors = require('cors');
// const helmet = require('helmet');
// const morgan = require('morgan');
// const rateLimit = require('express-rate-limit');
// require('dotenv').config();

// const connectDB = require('./config/db');
// const {connectRedis} = require('./config/rediss');
// const errorHandler = require('./middleware/errorHandler')
// const { restoreAllSessions } = require('./services/baileysSessionManager');;

// // Routes
// const authRoutes = require('./routes/auth');
// const businessRoutes = require('./routes/business');
// const productRoutes = require('./routes/product');
// const orderRoutes = require('./routes/order');
// const webhookRoutes = require('./routes/webhook');
// const analyticsRoutes = require('./routes/analytics');
// const whatsappRoutes = require('./routes/whatsapp');
// const subscriptionRoutes = require('./routes/subscription');

// const app = express();

// // Connect DB & Redis
// connectDB();
// connectRedis();
// await restoreAllSessions();

// // Security
// app.use(helmet());
// app.use(cors({
//   origin: process.env.FRONTEND_URL,
//   credentials: true,
// }));

// // Webhook route needs raw body for signature verification
// app.use('/api/webhook', express.raw({ type: 'application/json' }));

// // Body parsing
// app.use(express.json({ limit: '10mb' }));
// app.use(express.urlencoded({ extended: true }));

// // Logging
// if (process.env.NODE_ENV === 'development') {
//   app.use(morgan('dev'));
// }

// // Global rate limiter
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   max: 200,
//   message: { success: false, message: 'Too many requests, please try again later.' },
// });
// app.use('/api/', limiter);

// // Stricter limiter for auth
// const authLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   max: 20,
//   message: { success: false, message: 'Too many auth attempts.' },
// });
// app.use('/api/auth/', authLimiter);

// // Health check
// app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

// // API routes
// app.use('/api/auth', authRoutes);
// app.use('/api/business', businessRoutes);
// app.use('/api/products', productRoutes);
// app.use('/api/orders', orderRoutes);
// app.use('/api/webhook', webhookRoutes);
// app.use('/api/analytics', analyticsRoutes);
// app.use('/api/whatsapp', whatsappRoutes);
// app.use('/api/subscription', subscriptionRoutes);

// // 404
// app.use((req, res) => {
//   res.status(404).json({ success: false, message: 'Route not found' });
// });

// // Error handler
// app.use(errorHandler);

// const PORT = process.env.PORT || 5000;
// app.listen(PORT, () => {
//   console.log(`✅ OneServe backend running on port ${PORT}`);
// });

// module.exports = app;



const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const connectDB = require('./config/db');
const { connectRedis } = require('./config/rediss');
const { restoreAllSessions } = require('./services/baileysSessionManager');
const errorHandler = require('./middleware/errorHandler');

// Routes
const authRoutes = require('./routes/auth');
const businessRoutes = require('./routes/business');
const productRoutes = require('./routes/product');
const orderRoutes = require('./routes/order');
const webhookRoutes = require('./routes/webhook');
const analyticsRoutes = require('./routes/analytics');
const whatsappRoutes = require('./routes/whatsapp');
const subscriptionRoutes = require('./routes/subscription');
const couponRoutes = require('./routes/coupon');

const app = express();

// 🚀 START SERVER PROPERLY
const startServer = async () => {
  try {
    await connectDB();
    await connectRedis();

    await restoreAllSessions(); // 🔥 important

    // Security
    app.use(helmet());
    app.use(cors({
      origin: process.env.FRONTEND_URL,
      credentials: true,
    }));

    app.use('/api/webhook', express.raw({ type: 'application/json' }));

    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true }));

    if (process.env.NODE_ENV === 'development') {
      app.use(morgan('dev'));
    }

    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 200,
    });
    app.use('/api/', limiter);

    app.get('/health', (req, res) =>
      res.json({ status: 'ok', time: new Date() })
    );

    // Routes
    app.use('/api/auth', authRoutes);
    app.use('/api/business', businessRoutes);
    app.use('/api/products', productRoutes);
    app.use('/api/orders', orderRoutes);
    app.use('/api/webhook', webhookRoutes);
    app.use('/api/analytics', analyticsRoutes);
    app.use('/api/whatsapp', whatsappRoutes);
    app.use('/api/subscription', subscriptionRoutes);
    app.use('/api/coupons', couponRoutes);

    app.use((req, res) => {
      res.status(404).json({ success: false, message: 'Route not found' });
    });

    app.use(errorHandler);

    const PORT = process.env.PORT || 5000;

    app.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
    });

  } catch (err) {
    console.error('❌ Server failed to start:', err);
  }
};

startServer();