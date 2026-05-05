const Business = require('../models/Business');
const { createBaileysSession, disconnectBaileys } = require('../services/baileysSessionManager');
const { createWPPSession, disconnectWPP } = require('../services/wppSessionManager');
const QRCode = require('qrcode');
const { redis } = require('../config/rediss'); // ✅ ONLY THIS (Upstash)

// POST /api/whatsapp/connect
const connect = async (req, res, next) => {
  try {
    const { method, metaPhoneNumberId, metaToken } = req.body;
    const business = await Business.findById(req.business._id);

    if (!['meta', 'baileys', 'wppconnect'].includes(method)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid method. Use meta, baileys, or wppconnect',
      });
    }

    // ✅ META (no QR needed)
    if (method === 'meta') {
      if (!metaPhoneNumberId || !metaToken) {
        return res.status(400).json({
          success: false,
          message: 'metaPhoneNumberId and metaToken required',
        });
      }

      business.whatsapp.method = 'meta';
      business.whatsapp.metaPhoneNumberId = metaPhoneNumberId;
      business.whatsapp.metaToken = metaToken;
      business.whatsapp.connected = true;
      business.whatsapp.connectedAt = new Date();

      await business.save();

      return res.json({
        success: true,
        message: 'Meta WhatsApp connected successfully',
        method: 'meta',
      });
    }

    // ✅ Baileys / WPP → QR flow
    business.whatsapp.method = method;
    await business.save();

    const businessId = business._id.toString();

    res.json({
      success: true,
      message: 'Session starting. Poll /api/whatsapp/qr for QR code.',
      method,
    });

    const onConnected = async (user) => {
      business.whatsapp.connected = true;
      business.whatsapp.connectedAt = new Date();

      if (user?.id) {
        business.whatsapp.phoneNumber = user.id.split(':')[0];
      }

      await business.save();

      await redis.set(`wa:connected:${businessId}`, 'true');
    };

    const onDisconnected = async () => {
      business.whatsapp.connected = false;
      await business.save();

      await redis.del(`wa:connected:${businessId}`);
    };

    const onQR = async (qr) => {
      console.log("QR generated:", qr);

      await redis.set(`wa:qr:${businessId}`, qr, {
        ex: 300, // expires in 5 minutes
      });
    };

    if (method === 'baileys') {
      createBaileysSession(businessId, onQR, onConnected, onDisconnected)
        .catch(console.error);
    } else {
      createWPPSession(businessId, onQR, onConnected, onDisconnected)
        .catch(console.error);
    }

  } catch (err) {
    next(err);
  }
};


// GET /api/whatsapp/qr
const getQR = async (req, res, next) => {
  try {
    if (!req.business || !req.business._id) {
      return res.status(400).json({
        success: false,
        message: "Business ID missing",
      });
    }

    const businessId = req.business._id.toString();
    const qrKey = `wa:qr:${businessId}`;

    const qrData = await redis.get(qrKey);

    console.log("Checking key:", qrKey);
    console.log("QR Data:", qrData);

    if (!qrData) {
      const isConnected = await redis.get(`wa:connected:${businessId}`);

      if (isConnected) {
        return res.json({
          success: true,
          connected: true,
          message: 'Already connected',
        });
      }

      return res.json({
        success: false,
        message: 'QR not ready yet. Try again in a few seconds.',
      });
    }

    let qrImage = qrData;

    // convert to base64 if raw string
    if (!qrData.startsWith('data:image')) {
      qrImage = await QRCode.toDataURL(qrData);
    }

    res.json({
      success: true,
      qr: qrImage,
      connected: false,
    });

  } catch (err) {
    console.error(err);
    next(err);
  }
};


// GET /api/whatsapp/status
const getStatus = async (req, res, next) => {
  try {
    const business = await Business.findById(req.business._id);
    const businessId = req.business._id.toString();

    const liveConnected = await redis.get(`wa:connected:${businessId}`);

    res.json({
      success: true,
      method: business.whatsapp.method,
      connected: !!liveConnected || business.whatsapp.connected,
      phoneNumber: business.whatsapp.phoneNumber,
      connectedAt: business.whatsapp.connectedAt,
    });

  } catch (err) {
    next(err);
  }
};


// POST /api/whatsapp/disconnect
const disconnect = async (req, res, next) => {
  try {
    const business = await Business.findById(req.business._id);
    const businessId = business._id.toString();
    const method = business.whatsapp.method;

    if (method === 'baileys') {
      await disconnectBaileys(businessId);
    } else if (method === 'wppconnect') {
      await disconnectWPP(businessId);
    }

    business.whatsapp.connected = false;
    business.whatsapp.method = null;
    business.whatsapp.phoneNumber = '';
    business.whatsapp.sessionId = '';

    await business.save();

    await redis.del(`wa:qr:${businessId}`);
    await redis.del(`wa:connected:${businessId}`);

    res.json({ success: true, message: 'WhatsApp disconnected' });

  } catch (err) {
    next(err);
  }
};


// POST /api/whatsapp/test
const sendTest = async (req, res, next) => {
  try {
    const { to, message } = req.body;

    if (!to || !message) {
      return res.status(400).json({
        success: false,
        message: 'to and message required',
      });
    }

    const business = await Business.findById(req.business._id);
    const { sendWhatsAppMessage } = require('../services/whatsappService');

    await sendWhatsAppMessage(business, to, message);

    res.json({ success: true, message: 'Test message sent' });

  } catch (err) {
    next(err);
  }
};

// POST /api/whatsapp/broadcast
const broadcast = async (req, res, next) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ success: false, message: 'Message is required' });
    }

    const business = await Business.findById(req.business._id);
    if (!business.whatsapp.connected) {
      return res.status(400).json({ success: false, message: 'WhatsApp is not connected' });
    }

    const Customer = require('../models/Customer');
    const { sendWhatsAppMessage } = require('../services/whatsappService');

    const customers = await Customer.find({ business: business._id }).lean();
    if (!customers.length) {
      return res.status(400).json({ success: false, message: 'No customers found to broadcast to' });
    }

    let successCount = 0;
    // We do not await each message completely to avoid timing out the request, 
    // but sending sequentially with a small delay is safer for rate limits.
    // For a real production app with many customers, this should be a background job.
    // Here we run it async in the background and respond immediately.
    res.json({ success: true, message: `Broadcast started for ${customers.length} customers` });

    (async () => {
      for (const customer of customers) {
        try {
          await sendWhatsAppMessage(business, customer.waId, message);
          successCount++;
          await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay to prevent ban
        } catch (err) {
          console.error(`Broadcast failed for ${customer.waId}`, err);
        }
      }
      console.log(`Broadcast completed for ${business.name}. Sent: ${successCount}/${customers.length}`);
    })();

  } catch (err) {
    next(err);
  }
};

module.exports = {
  connect,
  getQR,
  getStatus,
  disconnect,
  sendTest,
  broadcast,
};