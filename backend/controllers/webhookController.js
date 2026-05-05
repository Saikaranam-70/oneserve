const crypto = require('crypto');
const Business = require('../models/Business');
const { handleIncomingMessage } = require('../services/botEngine');

// GET /api/webhook/:businessId — Meta webhook verification
const verifyWebhook = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
    console.log('✅ Webhook verified');
    return res.status(200).send(challenge);
  }
  res.status(403).json({ success: false, message: 'Forbidden' });
};

// POST /api/webhook/:businessId — Incoming Meta messages
const handleWebhook = async (req, res) => {
  try {
    // Verify signature
    const sig = req.headers['x-hub-signature-256'];
    if (sig) {
      const appSecret = process.env.META_APP_SECRET || process.env.META_WA_TOKEN;
      const expected = `sha256=${crypto.createHmac('sha256', appSecret).update(req.body).digest('hex')}`;
      if (sig !== expected) {
        return res.status(403).json({ success: false, message: 'Invalid signature' });
      }
    }

    const body = JSON.parse(req.body.toString());

    // Acknowledge immediately (Meta requires <5s response)
    res.status(200).json({ success: true });

    // Process async
    if (body.object !== 'whatsapp_business_account') return;

    const { businessId } = req.params;
    const business = await Business.findById(businessId);
    if (!business) return;

    await handleIncomingMessage('meta', businessId, body);
  } catch (err) {
    console.error('Webhook error:', err.message);
    if (!res.headersSent) res.status(200).json({ success: true }); // Always 200 to Meta
  }
};

module.exports = { verifyWebhook, handleWebhook };
