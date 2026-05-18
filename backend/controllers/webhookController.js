const crypto = require('crypto');
const Business = require('../models/Business');
const { handleIncomingMessage } = require('../services/botEngine');

// GET /api/webhook/:businessId — Meta webhook verification
const verifyWebhook = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const { businessId } = req.params;

  // The user specifies their respective business ID as the verify token
  if (mode === 'subscribe' && token === businessId) {
    console.log(`✅ Webhook verified for business: ${businessId}`);
    return res.status(200).send(challenge);
  }
  res.status(403).json({ success: false, message: 'Forbidden' });
};

// POST /api/webhook/:businessId — Incoming Meta messages
// const handleWebhook = async (req, res) => {
//   try {
//     // Verify signature
//     const sig = req.headers['x-hub-signature-256'];
//     if (sig) {
//       const appSecret = process.env.META_APP_SECRET || process.env.META_WA_TOKEN;
//       const expected = `sha256=${crypto.createHmac('sha256', appSecret).update(req.body).digest('hex')}`;
//       if (sig !== expected) {
//         return res.status(403).json({ success: false, message: 'Invalid signature' });
//       }
//     }

//     const body = JSON.parse(req.body.toString());

//     // Acknowledge immediately (Meta requires <5s response)
//     res.status(200).json({ success: true });

//     // Process async
//     if (body.object !== 'whatsapp_business_account') return;

//     const { businessId } = req.params;
//     const business = await Business.findById(businessId);
//     if (!business) return;

//     await handleIncomingMessage('meta', businessId, body);
//   } catch (err) {
//     console.error('Webhook error:', err.message);
//     if (!res.headersSent) res.status(200).json({ success: true }); // Always 200 to Meta
//   }
// };


const handleWebhook = async (req, res) => {
  try {
    console.log('📩 META WEBHOOK HIT');
    console.log('📦 Body type:', typeof req.body, Buffer.isBuffer(req.body));

    const body = JSON.parse(req.body.toString());
    console.log('📋 Parsed body:', JSON.stringify(body, null, 2));

    res.status(200).json({ success: true });

    if (body.object !== 'whatsapp_business_account') {
      console.log('⚠️ Not a whatsapp_business_account event, object was:', body.object);
      return;
    }

    const msg = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    console.log('💬 Extracted message:', JSON.stringify(msg, null, 2));

    if (!msg) {
      console.log('⚠️ No message found — probably a status update webhook');
      return;
    }

    const { businessId } = req.params;
    console.log('🏢 BusinessId from params:', businessId);

    const business = await Business.findById(businessId);
    console.log('🔍 Business found:', !!business, business?.whatsapp?.method);

    await handleIncomingMessage('meta', businessId, body);
    console.log('✅ handleIncomingMessage called successfully');

  } catch (err) {
    console.error('❌ Webhook error:', err.message);
    console.error(err.stack);
    if (!res.headersSent) res.status(200).json({ success: true });
  }
};
module.exports = { verifyWebhook, handleWebhook };
