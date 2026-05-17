// const { getWASocket } = require('./baileysSessionManager');
// const axios = require('axios');
// const { getWPPClient } = require('./wppSessionManager');

// // ───────── META CLOUD API ─────────
// const sendMetaMessage = async (business, toWaId, payload) => {
//   try {
//     const phoneNumberId = business.whatsapp.metaPhoneNumberId || process.env.META_PHONE_NUMBER_ID;
//     const token = business.whatsapp.metaToken || process.env.META_WA_TOKEN;
//     if (!phoneNumberId || !token) throw new Error("Meta credentials missing");

//     await axios.post(
//       `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
//       { messaging_product: 'whatsapp', to: toWaId, ...payload },
//       { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
//     );
//     console.log("✅ Meta message sent");
//   } catch (err) {
//     console.error("Meta send error:", err.response?.data || err.message);
//   }
// };

// // ───────── BAILEYS API ─────────
// const sendBaileysMessage = async (business, toWaId, payload) => {
//   try {
//     const sock = getWASocket(String(business._id));
//     if (!sock) return console.log("❌ No active Baileys socket");

//     const jid = toWaId.includes('@') ? toWaId : `${toWaId}@s.whatsapp.net`;
//     await sock.sendMessage(jid, payload);
//     console.log("✅ Baileys message sent");
//   } catch (err) {
//     console.error("Baileys send error:", err.message);
//   }
// };

// // ───────── WPPCONNECT API ─────────
// const sendWPPConnectMessage = async (business, toWaId, text) => {
//   try {
//     const client = getWPPClient(String(business._id));
//     if (!client) return console.log("❌ No active WPPConnect client");

//     const jid = toWaId.includes('@') ? toWaId : `${toWaId}@c.us`;
//     await client.sendText(jid, text);
//     console.log("✅ WPPConnect message sent");
//   } catch (err) {
//     console.error("WPPConnect send error:", err.message);
//   }
// };

// // ───────── UNIFIED SEND TEXT ─────────
// const sendWhatsAppMessage = async (business, toWaId, text) => {
//   const method = business.whatsapp?.method;
//   if (method === 'meta') return sendMetaMessage(business, toWaId, { type: 'text', text: { body: text } });
//   if (method === 'wppconnect') return sendWPPConnectMessage(business, toWaId, text);
//   return sendBaileysMessage(business, toWaId, { text }); // Default/Baileys
// };

// // ───────── UNIFIED SEND BUTTONS ─────────
// const sendWhatsAppButtons = async (business, toWaId, text, buttons) => {
//   const method = business.whatsapp?.method;

//   if (method === 'meta') {
//     return sendMetaMessage(business, toWaId, {
//       type: 'interactive',
//       interactive: {
//         type: 'button',
//         body: { text },
//         action: { buttons: buttons.map(b => ({ type: 'reply', reply: { id: b.id, title: b.title } })) }
//       }
//     });
//   }

//   if (method === 'wppconnect') {
//     // WPPConnect fallback to text with numbered list, as wppconnect buttons have varying support
//     const optionsText = buttons.map((b, i) => `*${i+1}.* ${b.title}`).join('\n');
//     return sendWPPConnectMessage(business, toWaId, `${text}\n\n${optionsText}\n\n👉 Reply with the exact text or number.`);
//   }

//   // Baileys (Fallback to numbered text if native buttons are blocked, but we'll try interactive structure if possible, or simple text since Baileys buttons are deprecated for standard WA)
//   // To be safe for all clients, we use text + options.
//   const optionsText = buttons.map((b, i) => `*${b.title}*`).join(' | ');
//   return sendBaileysMessage(business, toWaId, { text: `${text}\n\nReply with one of:\n${optionsText}` });
// };

// // ───────── UNIFIED SEND LIST (MENU) ─────────
// const sendProductListToCustomer = async (business, toWaId, products, isWelcome = false) => {
//   if (!products || !products.length) return sendWhatsAppMessage(business, toWaId, "❌ No products available");

//   const method = business.whatsapp?.method;
//   const welcomePrefix = isWelcome ? `Welcome to *${business.name}*! 👋\n\n` : '';

//   if (method === 'meta') {
//     const rows = products.slice(0, 10).map(p => ({
//       id: `add_${p._id}`,
//       title: p.name.substring(0, 24),
//       description: `₹${p.discountPrice || p.price}`.substring(0, 72)
//     }));
//     return sendMetaMessage(business, toWaId, {
//       type: 'interactive',
//       interactive: {
//         type: 'list',
//         header: { type: 'text', text: 'Menu' },
//         body: { text: `${welcomePrefix}Select an item to add to your cart:` },
//         footer: { text: 'Powered by OneServe' },
//         action: { button: 'View Menu', sections: [{ title: 'Products', rows }] }
//       }
//     });
//   }

//   // Fallback for Baileys/WPPConnect
//   const lines = products.map((p, i) => `*${i + 1}.* ${p.name} — ₹${p.discountPrice || p.price}`);
//   const text = `${welcomePrefix}🛒 *${business.name} Menu*\n\n${lines.join('\n')}\n\n👉 Reply with item number to add to cart.\n👉 Type *cart* to view cart.`;

//   if (method === 'wppconnect') {
//     try {
//       const { getWPPClient } = require('./wppSessionManager');
//       const client = getWPPClient(String(business._id));
//       if (!client) return console.log("❌ No active WPPConnect client");
//       const jid = toWaId.includes('@') ? toWaId : `${toWaId}@c.us`;
//       await client.sendText(jid, text);
//       return console.log("✅ WPPConnect menu sent");
//     } catch (err) {
//       console.error("WPPConnect list send error:", err.message);
//     }
//     return;
//   }

//   // Baileys
//   try {
//     const { getWASocket } = require('./baileysSessionManager');
//     const sock = getWASocket(String(business._id));
//     if (!sock) return console.log("❌ No active Baileys socket");
//     const jid = toWaId.includes('@') ? toWaId : `${toWaId}@s.whatsapp.net`;
//     await sock.sendMessage(jid, { text });
//     return console.log("✅ Baileys menu sent");
//   } catch (err) {
//     console.error("Baileys list send error:", err.message);
//   }
// };

// // ───────── SEND SPECIFIC PRODUCT IMAGE ─────────
// const sendProductImage = async (business, toWaId, product, textCaption) => {
//   const imageUrl = product.images?.[0]?.url;
//   const method = business.whatsapp?.method;

//   if (!imageUrl) {
//     return sendWhatsAppMessage(business, toWaId, textCaption);
//   }

//   if (method === 'meta') {
//     return sendMetaMessage(business, toWaId, {
//       type: 'image',
//       image: { link: imageUrl },
//     }).then(() => sendWhatsAppMessage(business, toWaId, textCaption)); // Caption via separate text or standard caption if supported, but meta separates them usually, though we can use caption natively.
//   }

//   if (method === 'wppconnect') {
//     try {
//       const { getWPPClient } = require('./wppSessionManager');
//       const client = getWPPClient(String(business._id));
//       if (!client) return;
//       const jid = toWaId.includes('@') ? toWaId : `${toWaId}@c.us`;
//       await client.sendImage(jid, imageUrl, 'product.jpg', textCaption);
//     } catch (err) { console.error(err.message); }
//     return;
//   }

//   // Baileys
//   try {
//     const { getWASocket } = require('./baileysSessionManager');
//     const sock = getWASocket(String(business._id));
//     if (!sock) return;
//     const jid = toWaId.includes('@') ? toWaId : `${toWaId}@s.whatsapp.net`;
//     await sock.sendMessage(jid, { image: { url: imageUrl }, caption: textCaption });
//   } catch (err) { console.error(err.message); }
// };

// module.exports = {
//   sendWhatsAppMessage,
//   sendWhatsAppButtons,
//   sendProductListToCustomer,
//   sendProductImage
// };




const { getWASocket } = require('./baileysSessionManager');
const axios = require('axios');
const { getWPPClient } = require('./wppSessionManager');

// ═══════════════════════════════════════════════════════════════════
// META CLOUD API — BASE SENDER
// ═══════════════════════════════════════════════════════════════════
const sendMetaMessage = async (business, toWaId, payload) => {
  try {
    const phoneNumberId = business.whatsapp.metaPhoneNumberId || process.env.META_PHONE_NUMBER_ID;
    const token = business.whatsapp.metaToken || process.env.META_WA_TOKEN;
    if (!phoneNumberId || !token) throw new Error('Meta credentials missing');

    const res = await axios.post(
      `https://graph.facebook.com/v25.0/${phoneNumberId}/messages`,
      { messaging_product: 'whatsapp', to: toWaId, ...payload },
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );
    console.log("✅ Meta message sent successfully!");
  } catch (err) {
    console.error('Meta send error:', err.response?.data || err.message);
    throw err;
  }
};

// ═══════════════════════════════════════════════════════════════════
// BAILEYS — BASE SENDER
// ═══════════════════════════════════════════════════════════════════
const sendBaileysMessage = async (business, toWaId, payload) => {
  try {
    const sock = getWASocket(String(business._id));
    if (!sock) return console.log('❌ No active Baileys socket');
    const jid = toWaId.includes('@') ? toWaId : `${toWaId}@s.whatsapp.net`;
    await sock.sendMessage(jid, payload);
  } catch (err) {
    console.error('Baileys send error:', err.message);
  }
};

// ═══════════════════════════════════════════════════════════════════
// WPPCONNECT — BASE SENDER
// ═══════════════════════════════════════════════════════════════════
const sendWPPText = async (business, toWaId, text) => {
  try {
    const client = getWPPClient(String(business._id));
    if (!client) return console.log('❌ No active WPPConnect client');
    const jid = toWaId.includes('@') ? toWaId : `${toWaId}@c.us`;
    await client.sendText(jid, text);
  } catch (err) {
    console.error('WPPConnect send error:', err.message);
  }
};

// ═══════════════════════════════════════════════════════════════════
// 1. PLAIN TEXT MESSAGE
// ═══════════════════════════════════════════════════════════════════
const sendWhatsAppMessage = async (business, toWaId, text) => {
  const method = business.whatsapp?.method;
  if (method === 'meta') return sendMetaMessage(business, toWaId, { type: 'text', text: { body: text, preview_url: false } });
  if (method === 'wppconnect') return sendWPPText(business, toWaId, text);
  return sendBaileysMessage(business, toWaId, { text });
};

// ═══════════════════════════════════════════════════════════════════
// 2. BUTTON MESSAGE (up to 3 quick-reply buttons)
//    buttons: [{ id: 'btn_1', title: 'Browse Menu' }, ...]
// ═══════════════════════════════════════════════════════════════════
const sendWhatsAppButtons = async (business, toWaId, headerText, bodyText, footerText, buttons) => {
  const method = business.whatsapp?.method;

  // ── META ──
  if (method === 'meta') {
    return sendMetaMessage(business, toWaId, {
      type: 'interactive',
      interactive: {
        type: 'button',
        ...(headerText && { header: { type: 'text', text: headerText } }),
        body: { text: bodyText },
        ...(footerText && { footer: { text: footerText } }),
        action: {
          buttons: buttons.slice(0, 3).map(b => ({
            type: 'reply',
            reply: { id: b.id, title: b.title.substring(0, 20) }
          }))
        }
      }
    });
  }

  // ── BAILEYS — use templateMessage style or fallback to text ──
  if (method === 'baileys' || !method) {
    // Baileys native buttons are deprecated on cloud WhatsApp; use text fallback
    const lines = buttons.map((b, i) => `*${i + 1}.* ${b.title}`).join('\n');
    const full = `${headerText ? `*${headerText}*\n\n` : ''}${bodyText}\n\n${lines}${footerText ? `\n\n_${footerText}_` : ''}`;
    return sendBaileysMessage(business, toWaId, { text: full });
  }

  // ── WPPCONNECT ──
  const lines = buttons.map((b, i) => `*${i + 1}.* ${b.title}`).join('\n');
  const full = `${headerText ? `*${headerText}*\n\n` : ''}${bodyText}\n\n${lines}${footerText ? `\n\n_${footerText}_` : ''}`;
  return sendWPPText(business, toWaId, full);
};

// ═══════════════════════════════════════════════════════════════════
// 3. LIST MESSAGE (interactive menu panel — like Mana Mitra)
//    sections: [{ title: 'Category', rows: [{ id, title, description }] }]
// ═══════════════════════════════════════════════════════════════════
const sendWhatsAppList = async (business, toWaId, headerText, bodyText, footerText, buttonLabel, sections) => {
  const method = business.whatsapp?.method;

  // ── META ──
  if (method === 'meta') {
    // Flatten & cap at 10 rows total (Meta limit per list message)
    const cappedSections = [];
    let total = 0;
    for (const section of sections) {
      if (total >= 10) break;
      const rows = section.rows.slice(0, 10 - total).map(r => ({
        id: r.id.substring(0, 200),
        title: r.title.substring(0, 24),
        ...(r.description && { description: r.description.substring(0, 72) })
      }));
      if (rows.length) {
        cappedSections.push({ title: section.title.substring(0, 24), rows });
        total += rows.length;
      }
    }

    return sendMetaMessage(business, toWaId, {
      type: 'interactive',
      interactive: {
        type: 'list',
        ...(headerText && { header: { type: 'text', text: headerText } }),
        body: { text: bodyText },
        ...(footerText && { footer: { text: footerText } }),
        action: {
          button: buttonLabel.substring(0, 20),
          sections: cappedSections
        }
      }
    });
  }

  // ── BAILEYS / WPPCONNECT — numbered text fallback ──
  const lines = [];
  let idx = 1;
  for (const section of sections) {
    lines.push(`*── ${section.title} ──*`);
    for (const row of section.rows) {
      lines.push(`*${idx}.* ${row.title}${row.description ? ` — _${row.description}_` : ''}`);
      idx++;
    }
    lines.push('');
  }
  const full = `${headerText ? `*${headerText}*\n\n` : ''}${bodyText}\n\n${lines.join('\n').trim()}${footerText ? `\n\n_${footerText}_` : ''}`;

  if (method === 'wppconnect') return sendWPPText(business, toWaId, full);
  return sendBaileysMessage(business, toWaId, { text: full });
};

// ═══════════════════════════════════════════════════════════════════
// 4. IMAGE MESSAGE with caption
// ═══════════════════════════════════════════════════════════════════
const sendProductImage = async (business, toWaId, product, textCaption) => {
  const imageUrl = product.images?.[0]?.url;
  const method = business.whatsapp?.method;

  if (!imageUrl) return sendWhatsAppMessage(business, toWaId, textCaption);

  // ── META ──
  if (method === 'meta') {
    return sendMetaMessage(business, toWaId, {
      type: 'image',
      image: { link: imageUrl, caption: textCaption }
    });
  }

  // ── BAILEYS ──
  if (!method || method === 'baileys') {
    return sendBaileysMessage(business, toWaId, {
      image: { url: imageUrl },
      caption: textCaption
    });
  }

  // ── WPPCONNECT ──
  try {
    const client = getWPPClient(String(business._id));
    if (!client) return;
    const jid = toWaId.includes('@') ? toWaId : `${toWaId}@c.us`;
    await client.sendImage(jid, imageUrl, 'product.jpg', textCaption);
  } catch (err) {
    console.error('WPP image error:', err.message);
    return sendWPPText(business, toWaId, textCaption);
  }
};

// ═══════════════════════════════════════════════════════════════════
// 5. REQUEST LOCATION (ask user to share their location)
// ═══════════════════════════════════════════════════════════════════
const sendLocationRequest = async (business, toWaId) => {
  const method = business.whatsapp?.method;
  const bodyText = '📍 *Share Your Delivery Location*\n\nTap the button below to share your *live/current location*, or simply *type your full address* manually.';

  // ── META — interactive location request ──
  if (method === 'meta') {
    return sendMetaMessage(business, toWaId, {
      type: 'interactive',
      interactive: {
        type: 'location_request_message',
        body: { text: bodyText },
        action: { name: 'send_location' }
      }
    });
  }

  // ── BAILEYS / WPPCONNECT — text prompt ──
  const msg = `${bodyText}\n\n👉 *Option 1:* Tap the 📎 (attachment) icon → *Location* → Share Live or Current Location\n👉 *Option 2:* Type your address manually below`;
  if (method === 'wppconnect') return sendWPPText(business, toWaId, msg);
  return sendBaileysMessage(business, toWaId, { text: msg });
};

// ═══════════════════════════════════════════════════════════════════
// 6. WELCOME MESSAGE with rich list (like Mana Mitra "Choose Service")
//    Used as the primary entry-point
// ═══════════════════════════════════════════════════════════════════
const sendWelcomeMenu = async (business, toWaId) => {
  const name = business.name;
  const method = business.whatsapp?.method;

  const welcomeBody = business.settings?.welcomeMessage ||
    `👋 Welcome to *${name}*!\n\nYour convenience is our priority. How can we help you today?`;

  // ── META — show list picker (like Mana Mitra panel) ──
  if (method === 'meta') {
    return sendWhatsAppList(
      business, toWaId,
      `🏪 ${name}`,
      welcomeBody,
      'Powered by OneServe',
      '📋 Choose Service',
      [
        {
          title: 'Main Menu',
          rows: [
            { id: 'menu_browse', title: '🛒 Browse Menu', description: 'View products & add to cart' },
            { id: 'menu_track', title: '📦 Track Order', description: 'Check your recent order status' },
            { id: 'menu_support', title: '💬 Talk to Us', description: 'Reach our support team' }
          ]
        }
      ]
    );
  }

  // ── BAILEYS / WPPCONNECT — button message ──
  return sendWhatsAppButtons(
    business, toWaId,
    `🏪 ${name}`,
    welcomeBody,
    'Powered by OneServe',
    [
      { id: 'menu_browse', title: '🛒 Browse Menu' },
      { id: 'menu_track', title: '📦 Track Order' },
      { id: 'menu_support', title: '💬 Talk to Us' }
    ]
  );
};

// ═══════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════
module.exports = {
  sendWhatsAppMessage,
  sendWhatsAppButtons,
  sendWhatsAppList,
  sendProductImage,
  sendLocationRequest,
  sendWelcomeMenu
};