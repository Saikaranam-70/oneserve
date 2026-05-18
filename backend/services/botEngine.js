// const Business = require('../models/Business');
// const Product = require('../models/Product');
// const Order = require('../models/Order');
// const Customer = require('../models/Customer');
// const Coupon = require('../models/Coupon');
// const { sendWhatsAppMessage, sendWhatsAppButtons, sendProductListToCustomer, sendProductImage } = require('./whatsappService');
// const { redis } = require('../config/rediss');
// const { v4: uuidv4 } = require('uuid');

// // ───── HELPERS ─────

// const getCartKey = (businessId, waId) => `cart:${businessId}:${waId}`;
// const getStateKey = (businessId, waId) => `state:${businessId}:${waId}`;
// const getLocationKey = (businessId, waId) => `loc:${businessId}:${waId}`;

// const safeParse = (data, fallback) => {
//   if (!data) return fallback;
//   try {
//     return typeof data === 'string' ? JSON.parse(data) : data;
//   } catch {
//     return fallback;
//   }
// };

// const getCart = async (businessId, waId) => {
//   const raw = await redis.get(getCartKey(businessId, waId));
//   return safeParse(raw, []);
// };

// const saveCart = async (businessId, waId, cart) => {
//   await redis.set(getCartKey(businessId, waId), JSON.stringify(cart), { ex: 3600 });
// };

// const getState = async (businessId, waId) => {
//   return (await redis.get(getStateKey(businessId, waId))) || 'idle';
// };

// const setState = async (businessId, waId, state) => {
//   await redis.set(getStateKey(businessId, waId), state, { ex: 3600 });
// };

// const setLocation = async (businessId, waId, locData) => {
//   await redis.set(getLocationKey(businessId, waId), JSON.stringify(locData), { ex: 3600 });
// };

// const getLocation = async (businessId, waId) => {
//   const raw = await redis.get(getLocationKey(businessId, waId));
//   return safeParse(raw, null);
// };

// const clearSession = async (businessId, waId) => {
//   await redis.del(getCartKey(businessId, waId));
//   await redis.del(getStateKey(businessId, waId));
//   await redis.del(getLocationKey(businessId, waId));
//   await redis.del(`cache:categories:${businessId}:${waId}`);
//   await redis.del(`cache:items:${businessId}:${waId}`);
//   await redis.del(`cache:coupon:${businessId}:${waId}`);
// };

// const generateOrderId = () =>
//   `ORD-${Date.now().toString(36).toUpperCase()}-${uuidv4().slice(0, 4).toUpperCase()}`;

// const formatCart = (cart) => {
//   const lines = cart.map((i, idx) =>
//     `${idx + 1}. ${i.name} x${i.quantity} — ₹${i.price * i.quantity}`
//   );
//   const total = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
//   return `🛒 *Your Cart*\n\n${lines.join('\n')}\n\n*Total: ₹${total}*`;
// };

// const formatCartSummary = (cart) => {
//   return cart.map(i => `${i.name} x${i.quantity} = ₹${i.price * i.quantity}`).join('\n');
// };

// const getWelcomeText = (business) => {
//   const customWelcome = business.settings?.welcomeMessage || `Hi! Welcome to *${business.name}*.`;
//   return `${customWelcome}\n\nReply:\n1. Browse Menu\n2. Track Order\n3. Talk to us`;
// };

// // ───── NORMALIZER ─────

// const normaliseMessage = (provider, rawMsg) => {
//   try {
//     if (provider === 'meta') {
//       const entry = rawMsg.entry?.[0];
//       const change = entry?.changes?.[0];
//       const msg = change?.value?.messages?.[0];
//       const contact = change?.value?.contacts?.[0];
//       if (!msg) return null;

//       let text = '';
//       let location = null;

//       if (msg.type === 'text') text = msg.text?.body || '';
//       else if (msg.type === 'interactive') {
//         text = msg.interactive?.list_reply?.id || msg.interactive?.button_reply?.id || '';
//       } else if (msg.type === 'location') {
//         location = { lat: msg.location.latitude, lng: msg.location.longitude, address: msg.location.address || '' };
//       }
//       return { waId: msg.from, text: text.trim(), location, name: contact?.profile?.name || 'Customer', msgId: msg.id };
//     }

//     if (provider === 'baileys') {
//       const waId = rawMsg.key?.senderPn?.replace('@s.whatsapp.net', '') || rawMsg.key?.remoteJid?.replace('@s.whatsapp.net', '');
//       if (!waId) return null;

//       let text = rawMsg.message?.conversation || rawMsg.message?.extendedTextMessage?.text || '';
//       let location = null;

//       // Check for buttons/lists if any client still sends them this way to Baileys
//       if (rawMsg.message?.buttonsResponseMessage) {
//         text = rawMsg.message.buttonsResponseMessage.selectedButtonId || '';
//       } else if (rawMsg.message?.listResponseMessage) {
//         text = rawMsg.message.listResponseMessage.singleSelectReply?.selectedRowId || '';
//       } else if (rawMsg.message?.locationMessage) {
//         location = { lat: rawMsg.message.locationMessage.degreesLatitude, lng: rawMsg.message.locationMessage.degreesLongitude, address: rawMsg.message.locationMessage.address || '' };
//       }

//       const name = rawMsg.pushName || 'Customer';
//       return { waId, text: text.trim(), location, name, msgId: rawMsg.key?.id };
//     }

//     if (provider === 'wppconnect') {
//       const waId = rawMsg.from?.replace('@c.us', '') || '';
//       if (!waId) return null;

//       let text = rawMsg.body?.trim() || '';
//       let location = null;

//       if (rawMsg.type === 'location') {
//         location = { lat: rawMsg.lat, lng: rawMsg.lng, address: rawMsg.loc || '' };
//       } else if (rawMsg.type === 'buttons_response' || rawMsg.type === 'list_response') {
//         text = rawMsg.body || ''; // WPPConnect usually puts button text in body
//       }

//       const name = rawMsg.sender?.pushname || 'Customer';
//       return { waId, text, location, name, msgId: rawMsg.id };
//     }
//   } catch (err) {
//     console.error("Normalizer error:", err.message);
//   }
//   return null;
// };

// // ───── MAIN HANDLER ─────

// const handleIncomingMessage = async (provider, businessId, rawMsg) => {
//   try {
//     const parsed = normaliseMessage(provider, rawMsg);
//     if (!parsed) return;

//     const { waId, text, location, name, msgId } = parsed;
//     const lowerText = text.toLowerCase().trim();

//     if (!text && !location) return; // Ignore empty messages if no text/loc

//     // ─── Deduplication ───
//     if (msgId) {
//       const isNew = await redis.setnx(`msg_dedup:${msgId}`, '1');
//       if (!isNew) return; // Duplicate message, ignore
//       await redis.expire(`msg_dedup:${msgId}`, 120);
//     }

//     // ─── Business Cache ───
//     const cacheKey = `biz:${businessId}`;
//     let business;
//     const cached = await redis.get(cacheKey);
//     if (cached) {
//       business = safeParse(cached, null);
//     } else {
//       business = await Business.findById(businessId).lean();
//       if (business) await redis.set(cacheKey, JSON.stringify(business), { ex: 300 });
//     }
//     if (!business) return;

//     // ─── Customer ───
//     let customer = await Customer.findOneAndUpdate(
//       { business: businessId, waId },
//       { name: name || 'Customer', phone: waId },
//       { upsert: true, new: true }
//     );

//     const reply = (msg) => sendWhatsAppMessage(business, waId, msg);

//     if (lowerText === 'hi' || lowerText === 'hello' || lowerText === 'hey' || lowerText === 'menu') {
//       await setState(businessId, waId, 'idle');
//     }

//     let state = await getState(businessId, waId);

//     // ─── Ask for Name (Onboarding) ───
//     if (state === 'idle' && (!customer.name || customer.name === 'Customer')) {
//       await setState(businessId, waId, 'awaiting_name');
//       return reply(`Welcome to *${business.name}*! 👋\n\nCould you please tell me your full name to proceed?`);
//     }

//     if (state === 'awaiting_name') {
//       if (!text || text.length < 2) return reply("Please type a valid name.");
//       customer.name = text;
//       await customer.save();
//       await setState(businessId, waId, 'idle');
//       return reply(`Nice to meet you, *${text}*!\n\n${getWelcomeText(business)}`);
//     }

//     // ─── Global Cancel ───
//     if (lowerText === 'cancel' || lowerText === 'reset' || lowerText === '0') {
//       await clearSession(businessId, waId);
//       state = 'idle';
//     }

//     // ─── STATE MACHINE ───

//     if (state === 'idle') {
//       await setState(businessId, waId, 'welcome');
//       return reply(getWelcomeText(business));
//     }

//     if (state === 'welcome') {
//       if (lowerText === '1') {
//         const categories = await Product.distinct('category', { business: businessId, isAvailable: true });
//         if (!categories.length) return reply("Sorry, no products are currently available.");

//         await redis.set(`cache:categories:${businessId}:${waId}`, JSON.stringify(categories), { ex: 3600 });
//         await setState(businessId, waId, 'browsing_categories');

//         const catList = categories.map((c, i) => `${i + 1}. ${c}`).join('\n');
//         return reply(`Choose category:\n${catList}\n0. Back`);
//       } else if (lowerText === '2') {
//         const orders = await Order.find({ business: businessId, 'customer.waId': waId })
//           .sort({ createdAt: -1 }).limit(3).lean();
//         if (!orders.length) return reply('You have no orders yet. Reply *0* to go back.');
//         const lines = orders.map(o => `📦 *${o.orderId}* — ${o.status.toUpperCase()} — ₹${o.total}`);
//         return reply(`*Your Recent Orders*\n\n${lines.join('\n')}\n\nReply *0* to go back.`);
//       } else if (lowerText === '3') {
//         return reply(`Please contact our support at ${business.phone || 'our official number'}. Reply *0* to go back.`);
//       } else if (lowerText === '0') {
//         await setState(businessId, waId, 'idle');
//         return reply(getWelcomeText(business));
//       } else {
//         return reply("Invalid choice. Please reply with 1, 2, or 3. Reply *0* to go back.");
//       }
//     }

//     if (state === 'browsing_categories') {
//       if (lowerText === '0') {
//         await setState(businessId, waId, 'welcome');
//         return reply(getWelcomeText(business));
//       }

//       const num = parseInt(lowerText);
//       const rawCats = await redis.get(`cache:categories:${businessId}:${waId}`);
//       const categories = safeParse(rawCats, []);

//       if (!isNaN(num) && num > 0 && num <= categories.length) {
//         const selectedCat = categories[num - 1];
//         const products = await Product.find({ business: businessId, category: selectedCat, isAvailable: true }).sort({ sortOrder: 1, name: 1 }).lean();

//         if (!products.length) return reply(`No items in ${selectedCat}. Reply *0* to go back.`);

//         await redis.set(`cache:items:${businessId}:${waId}`, JSON.stringify(products.map(p => ({_id: p._id, name: p.name, price: p.discountPrice || p.price}))), { ex: 3600 });
//         await setState(businessId, waId, 'browsing_items');

//         const itemList = products.map((p, i) => `${i + 1}. ${p.name} - ₹${p.discountPrice || p.price}`).join('\n');
//         return reply(`${itemList}\nReply number to add. 0 = Back`);
//       } else {
//         return reply("Invalid choice. Reply with a category number, or *0* to go back.");
//       }
//     }

//     if (state === 'browsing_items') {
//       if (lowerText === '0') {
//         const rawCats = await redis.get(`cache:categories:${businessId}:${waId}`);
//         const categories = safeParse(rawCats, []);
//         if(!categories.length) {
//              await setState(businessId, waId, 'welcome');
//              return reply(getWelcomeText(business));
//         }
//         await setState(businessId, waId, 'browsing_categories');
//         const catList = categories.map((c, i) => `${i + 1}. ${c}`).join('\n');
//         return reply(`Choose category:\n${catList}\n0. Back`);
//       }

//       const num = parseInt(lowerText);
//       const rawItems = await redis.get(`cache:items:${businessId}:${waId}`);
//       const items = safeParse(rawItems, []);

//       if (!isNaN(num) && num > 0 && num <= items.length) {
//         const selectedItem = items[num - 1];

//         const cart = await getCart(businessId, waId);
//         const existing = cart.find(i => i.productId === selectedItem._id.toString());
//         if (existing) existing.quantity += 1;
//         else cart.push({ productId: selectedItem._id.toString(), name: selectedItem.name, price: selectedItem.price, quantity: 1 });

//         await saveCart(businessId, waId, cart);

//         const cartTotal = cart.reduce((sum, i) => sum + (i.price * i.quantity), 0);
//         await setState(businessId, waId, 'item_added');

//         const productInfo = await Product.findById(selectedItem._id).lean();
//         const caption = `✅ *${selectedItem.name}* added to cart!\n🛒 Cart Total: ₹${cartTotal}\n\n👉 *Reply:*\n*1.* Add more\n*2.* View cart\n*3.* Checkout`;

//         if (productInfo?.images?.[0]?.url) {
//           return sendProductImage(business, waId, productInfo, caption);
//         } else {
//           return reply(caption);
//         }
//       } else {
//         return reply("Invalid choice. Reply with an item number, or *0* to go back.");
//       }
//     }

//     if (state === 'item_added') {
//       if (lowerText === '1') {
//         const rawCats = await redis.get(`cache:categories:${businessId}:${waId}`);
//         const categories = safeParse(rawCats, []);
//         if(categories.length) {
//             await setState(businessId, waId, 'browsing_categories');
//             const catList = categories.map((c, i) => `${i + 1}. ${c}`).join('\n');
//             return reply(`Choose category:\n${catList}\n0. Back`);
//         } else {
//             await setState(businessId, waId, 'idle');
//             return reply(getWelcomeText(business));
//         }
//       } else if (lowerText === '2') {
//         const cart = await getCart(businessId, waId);
//         return reply(`${formatCart(cart)}\n\n1. Add more\n3. Checkout`);
//       } else if (lowerText === '3') {
//         const cart = await getCart(businessId, waId);
//         if (!cart.length) return reply("Cart is empty. Reply *1* to add more.");

//         await setState(businessId, waId, 'checkout_delivery');
//         return reply("How would you like your order?\n1. Home Delivery\n2. Self Pickup");
//       } else if (lowerText === '0') {
//          await setState(businessId, waId, 'welcome');
//          return reply(getWelcomeText(business));
//       } else {
//         return reply("Invalid choice. Reply 1 (Add more), 2 (View cart), or 3 (Checkout).");
//       }
//     }

//     if (state === 'checkout_delivery') {
//       if (lowerText === '1') {
//         await setState(businessId, waId, 'checkout_address');
//         return reply("Please type your full delivery address or share your location pin:");
//       } else if (lowerText === '2') {
//         await setLocation(businessId, waId, { type: 'pickup', address: 'Self Pickup' });
//         await setState(businessId, waId, 'checkout_coupon');
//         return reply(`Do you have a discount coupon code?\n\nType the code below, or type *SKIP* if you don't have one.`);
//       } else {
//         return reply("Invalid choice.\n1. Home Delivery\n2. Self Pickup");
//       }
//     }

//     if (state === 'checkout_address') {
//       if (!text && !location) {
//         return reply("Please type your delivery address or share a location pin.");
//       }

//       let addrStr = 'Location Pin';
//       if (location) {
//         let fullAddress = location.address || '';
//         if (!fullAddress && location.lat && location.lng) {
//           try {
//             const axios = require('axios');
//             const { data } = await axios.get(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${location.lat}&lon=${location.lng}`, {
//               headers: { 'User-Agent': 'OneServeBot/1.0' }
//             });
//             if (data && data.display_name) fullAddress = data.display_name;
//           } catch (e) {
//             console.error("Reverse geocoding failed:", e.message);
//           }
//         }
//         addrStr = fullAddress || `Lat: ${location.lat}, Lng: ${location.lng}`;
//         await setLocation(businessId, waId, { ...location, address: addrStr, type: 'delivery' });
//       } else {
//         await setLocation(businessId, waId, { address: text, type: 'delivery' });
//         addrStr = text;
//       }

//       await setState(businessId, waId, 'checkout_coupon');
//       return reply(`Do you have a discount coupon code?\n\nType the code below, or type *SKIP* if you don't have one.`);
//     }

//     if (state === 'checkout_coupon') {
//       const cart = await getCart(businessId, waId);
//       const subtotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
//       let discount = 0;
//       let couponCode = '';

//       if (lowerText !== 'skip') {
//         const coupon = await Coupon.findOne({ business: businessId, code: text.toUpperCase(), isActive: true });
//         if (!coupon) {
//           return reply(`❌ Invalid or inactive coupon code. Try another, or type *SKIP*`);
//         }
//         if (subtotal < coupon.minOrderValue) {
//           return reply(`⚠️ This coupon requires a minimum order of ₹${coupon.minOrderValue}. Try another, or type *SKIP*`);
//         }
//         // Valid coupon
//         await redis.set(`cache:coupon:${businessId}:${waId}`, JSON.stringify({ code: coupon.code, type: coupon.discountType, value: coupon.discountValue, max: coupon.maxDiscount }), { ex: 3600 });
//         couponCode = coupon.code;
//         discount = coupon.discountType === 'percentage' ? (subtotal * coupon.discountValue) / 100 : coupon.discountValue;
//         if (coupon.maxDiscount && discount > coupon.maxDiscount) discount = coupon.maxDiscount;
//       }

//       await setState(businessId, waId, 'checkout_payment');

//       const locData = await getLocation(businessId, waId);
//       const isDelivery = locData && locData.type === 'delivery';
//       const fee = business.settings?.deliveryFee !== undefined ? business.settings.deliveryFee : 30;
//       const deliveryFee = isDelivery ? fee : 0;
//       const total = subtotal + deliveryFee - discount;

//       let msg = `🧾 *Order Summary*\n\n${formatCartSummary(cart)}\n\nSubtotal: ₹${subtotal}\nDelivery: ₹${deliveryFee}`;
//       if (discount > 0) msg += `\nDiscount (${couponCode}): -₹${discount.toFixed(0)}`;
//       msg += `\n*Total: ₹${total.toFixed(0)}*\n\n👉 *Reply:*\n*1.* Pay Online (UPI/Card)\n*2.* Cash on Delivery`;

//       return reply(msg);
//     }

//     if (state === 'checkout_payment') {
//       const cart = await getCart(businessId, waId);
//       if (!cart.length) {
//          await setState(businessId, waId, 'idle');
//          return reply("Cart expired. Let's start over.\nHi! Welcome. Reply:\n1. Browse Menu");
//       }

//       const locData = await getLocation(businessId, waId);
//       const isDelivery = locData && locData.type === 'delivery';
//       const subtotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
//       const fee = business.settings?.deliveryFee !== undefined ? business.settings.deliveryFee : 30;
//       const deliveryFee = isDelivery ? fee : 0;

//       let discount = 0;
//       let couponCode = '';
//       const rawCoupon = await redis.get(`cache:coupon:${businessId}:${waId}`);
//       if (rawCoupon) {
//         const c = JSON.parse(rawCoupon);
//         couponCode = c.code;
//         discount = c.type === 'percentage' ? (subtotal * c.value) / 100 : c.value;
//         if (c.max && discount > c.max) discount = c.max;
//       }

//       const total = subtotal + deliveryFee - discount;

//       if (lowerText === '1' || lowerText === '2') {
//         const order = await Order.create({
//           business: businessId,
//           orderId: generateOrderId(),
//           customer: { name, phone: waId, waId },
//           items: cart.map(i => ({
//             product: i.productId,
//             name: i.name,
//             price: i.price,
//             quantity: i.quantity,
//             total: i.price * i.quantity
//           })),
//           subtotal,
//           deliveryCharge: deliveryFee,
//           discount,
//           couponCode,
//           total,
//           deliveryAddress: locData?.address || (isDelivery ? 'Location Pin' : 'Self Pickup'),
//           deliveryType: isDelivery ? 'delivery' : 'pickup',
//           status: 'pending',
//           statusHistory: [{ status: 'pending' }],
//         });

//         await Customer.updateOne(
//           { business: businessId, waId },
//           { $inc: { totalOrders: 1, totalSpent: total }, $set: { lastOrderAt: new Date() } }
//         );

//         if (couponCode) {
//           await Coupon.findOneAndUpdate({ business: businessId, code: couponCode }, { $inc: { usedCount: 1 } });
//         }

//         await clearSession(businessId, waId);

//         if (lowerText === '1') {
//           return reply(`Payment Link: https://rzp.io/i/dummy${order.orderId}\n\nOrder #${order.orderId} placed! ETA: 30-40 mins. Reply TRACK to check status. Thank you for ordering with us!`);
//         } else {
//           return reply(`Order #${order.orderId} placed! ETA: 30-40 mins. Reply TRACK to check status. Thank you for ordering with us!`);
//         }
//       } else {
//         return reply("Invalid choice.\n1. Pay Online (UPI/Card)\n2. Cash on Delivery");
//       }
//     }

//     // Default fallback
//     await clearSession(businessId, waId);
//     await setState(businessId, waId, 'welcome');
//     return reply(`Sorry, I didn't understand that.\n\n${getWelcomeText(business)}`);

//   } catch (err) {
//     console.error("BOT ERROR:", err);
//   }
// };

// module.exports = { handleIncomingMessage };


// const Business = require('../models/Business');
// const Product = require('../models/Product');
// const Order = require('../models/Order');
// const Customer = require('../models/Customer');
// const Coupon = require('../models/Coupon');
// const {
//   sendWhatsAppMessage,
//   sendWhatsAppButtons,
//   sendWhatsAppList,
//   sendProductImage,
//   sendLocationRequest,
//   sendWelcomeMenu,
// } = require('./whatsappService');
// const { redis } = require('../config/rediss');
// const { v4: uuidv4 } = require('uuid');

// // ═══════════════════════════════════════════════════════════════════
// // REDIS KEY HELPERS
// // ═══════════════════════════════════════════════════════════════════
// const getCartKey = (b, w) => `cart:${b}:${w}`;
// const getStateKey = (b, w) => `state:${b}:${w}`;
// const getLocationKey = (b, w) => `loc:${b}:${w}`;
// const getCatKey = (b, w) => `cache:categories:${b}:${w}`;
// const getItemsKey = (b, w) => `cache:items:${b}:${w}`;
// const getCouponKey = (b, w) => `cache:coupon:${b}:${w}`;
// const getPageKey = (b, w) => `page:${b}:${w}`; // for pagination

// const safeParse = (data, fallback) => {
//   if (!data) return fallback;
//   try { return typeof data === 'string' ? JSON.parse(data) : data; }
//   catch { return fallback; }
// };

// const getCart = async (b, w) => safeParse(await redis.get(getCartKey(b, w)), []);
// const saveCart = async (b, w, cart) => redis.set(getCartKey(b, w), JSON.stringify(cart), { ex: 3600 });
// const getState = async (b, w) => (await redis.get(getStateKey(b, w))) || 'idle';
// const setState = async (b, w, s) => redis.set(getStateKey(b, w), s, { ex: 3600 });
// const setLocation = async (b, w, d) => redis.set(getLocationKey(b, w), JSON.stringify(d), { ex: 3600 });
// const getLocation = async (b, w) => safeParse(await redis.get(getLocationKey(b, w)), null);

// const clearSession = async (b, w) => {
//   await Promise.all([
//     redis.del(getCartKey(b, w)),
//     redis.del(getStateKey(b, w)),
//     redis.del(getLocationKey(b, w)),
//     redis.del(getCatKey(b, w)),
//     redis.del(getItemsKey(b, w)),
//     redis.del(getCouponKey(b, w)),
//     redis.del(getPageKey(b, w)),
//   ]);
// };

// const generateOrderId = () =>
//   `ORD-${Date.now().toString(36).toUpperCase()}-${uuidv4().slice(0, 4).toUpperCase()}`;

// // ═══════════════════════════════════════════════════════════════════
// // FORMATTERS
// // ═══════════════════════════════════════════════════════════════════
// const formatCartText = (cart) => {
//   const lines = cart.map((i, idx) => `${idx + 1}. ${i.name} ×${i.quantity} — ₹${i.price * i.quantity}`);
//   const total = cart.reduce((s, i) => s + i.price * i.quantity, 0);
//   return `🛒 *Your Cart*\n\n${lines.join('\n')}\n\n*Total: ₹${total}*`;
// };

// const cartTotal = (cart) => cart.reduce((s, i) => s + i.price * i.quantity, 0);

// // ═══════════════════════════════════════════════════════════════════
// // MESSAGE NORMALIZER — Meta / Baileys / WPPConnect → unified format
// // ═══════════════════════════════════════════════════════════════════
// const normaliseMessage = (provider, rawMsg) => {
//   try {
//     if (provider === 'meta') {
//       const msg = rawMsg.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
//       const contact = rawMsg.entry?.[0]?.changes?.[0]?.value?.contacts?.[0];
//       if (!msg) return null;

//       let text = '';
//       let location = null;

//       if (msg.type === 'text') {
//         text = msg.text?.body || '';
//       } else if (msg.type === 'interactive') {
//         const ir = msg.interactive;
//         text = ir?.list_reply?.id || ir?.button_reply?.id || ir?.list_reply?.title || ir?.button_reply?.title || '';
//       } else if (msg.type === 'location') {
//         location = {
//           lat: msg.location.latitude,
//           lng: msg.location.longitude,
//           address: msg.location.address || msg.location.name || ''
//         };
//       }

//       return { waId: msg.from, text: text.trim(), location, name: contact?.profile?.name || 'Customer', msgId: msg.id };
//     }

//     if (provider === 'baileys') {
//       const waId = rawMsg.key?.senderPn?.replace('@s.whatsapp.net', '') ||
//         rawMsg.key?.remoteJid?.replace('@s.whatsapp.net', '');
//       if (!waId) return null;

//       let text = rawMsg.message?.conversation ||
//         rawMsg.message?.extendedTextMessage?.text || '';
//       let location = null;

//       if (rawMsg.message?.buttonsResponseMessage)
//         text = rawMsg.message.buttonsResponseMessage.selectedButtonId || '';
//       else if (rawMsg.message?.listResponseMessage)
//         text = rawMsg.message.listResponseMessage.singleSelectReply?.selectedRowId || '';
//       else if (rawMsg.message?.locationMessage) {
//         location = {
//           lat: rawMsg.message.locationMessage.degreesLatitude,
//           lng: rawMsg.message.locationMessage.degreesLongitude,
//           address: rawMsg.message.locationMessage.address || ''
//         };
//       }
//       // Live location
//       else if (rawMsg.message?.liveLocationMessage) {
//         location = {
//           lat: rawMsg.message.liveLocationMessage.degreesLatitude,
//           lng: rawMsg.message.liveLocationMessage.degreesLongitude,
//           address: rawMsg.message.liveLocationMessage.address || ''
//         };
//       }

//       return { waId, text: text.trim(), location, name: rawMsg.pushName || 'Customer', msgId: rawMsg.key?.id };
//     }

//     if (provider === 'wppconnect') {
//       const waId = rawMsg.from?.replace('@c.us', '') || '';
//       if (!waId) return null;

//       let text = rawMsg.body?.trim() || '';
//       let location = null;

//       if (rawMsg.type === 'location') {
//         location = {
//           lat: rawMsg.lat,
//           lng: rawMsg.lng,
//           address: rawMsg.loc || rawMsg.address || ''
//         };
//       } else if (rawMsg.type === 'live_location') {
//         location = {
//           lat: rawMsg.lat,
//           lng: rawMsg.lng,
//           address: rawMsg.loc || ''
//         };
//       } else if (rawMsg.type === 'buttons_response' || rawMsg.type === 'list_response') {
//         text = rawMsg.selectedButtonId || rawMsg.selectedRowId || rawMsg.body || '';
//       }

//       return { waId, text, location, name: rawMsg.sender?.pushname || 'Customer', msgId: rawMsg.id };
//     }
//   } catch (err) {
//     console.error('Normalizer error:', err.message);
//   }
//   return null;
// };

// // ═══════════════════════════════════════════════════════════════════
// // REVERSE GEOCODE (for location pin → readable address)
// // ═══════════════════════════════════════════════════════════════════
// const reverseGeocode = async (lat, lng) => {
//   try {
//     const axios = require('axios');
//     const { data } = await axios.get(
//       `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
//       { headers: { 'User-Agent': 'OneServeBot/1.0' }, timeout: 5000 }
//     );
//     return data?.display_name || '';
//   } catch {
//     return '';
//   }
// };

// // ═══════════════════════════════════════════════════════════════════
// // RICH UI HELPERS
// // ═══════════════════════════════════════════════════════════════════

// /**
//  * Send category list as an interactive list (like Mana Mitra service picker)
//  */
// const sendCategoryList = async (business, waId, categories) => {
//   const rows = categories.map((cat, i) => ({
//     id: `cat_${i}`,
//     title: cat.substring(0, 24),
//     description: `Browse ${cat} items`
//   }));

//   return sendWhatsAppList(
//     business, waId,
//     '🛍️ Shop by Category',
//     'Select a category to browse available products:',
//     'Reply *0* anytime to go back',
//     '📂 Pick Category',
//     [{ title: 'Categories', rows }]
//   );
// };

// /**
//  * Send product list — if ≤3 products use buttons, otherwise use list message
//  */
// const sendProductList = async (business, waId, products, categoryName) => {
//   if (products.length <= 3) {
//     // Use button message for small lists
//     return sendWhatsAppButtons(
//       business, waId,
//       `🍽️ ${categoryName}`,
//       products.map((p, i) =>
//         `*${i + 1}.* ${p.name}\n💰 ₹${p.discountPrice || p.price}${p.description ? `\n_${p.description.substring(0, 60)}_` : ''}`
//       ).join('\n\n'),
//       'Tap to add to cart',
//       products.slice(0, 3).map((p, i) => ({
//         id: `item_${i}`,
//         title: p.name.substring(0, 20)
//       }))
//     );
//   }

//   // Use list message for larger menus
//   const rows = products.map((p, i) => ({
//     id: `item_${i}`,
//     title: p.name.substring(0, 24),
//     description: `₹${p.discountPrice || p.price}${p.description ? ' • ' + p.description.substring(0, 50) : ''}`
//   }));

//   return sendWhatsAppList(
//     business, waId,
//     `🍽️ ${categoryName}`,
//     `Here are the available items in *${categoryName}*.\nTap any item to add it to your cart:`,
//     'Reply *0* to go back to categories',
//     '🛒 Select Item',
//     [{ title: categoryName, rows }]
//   );
// };

// /**
//  * Send cart with action buttons
//  */
// const sendCartWithActions = async (business, waId, cart) => {
//   const total = cartTotal(cart);
//   const lines = cart.map((i, idx) =>
//     `${idx + 1}. ${i.name} ×${i.quantity} — ₹${i.price * i.quantity}`
//   ).join('\n');

//   return sendWhatsAppButtons(
//     business, waId,
//     `🛒 Your Cart (₹${total})`,
//     lines || 'Your cart is empty.',
//     'What would you like to do?',
//     [
//       { id: 'cart_more', title: '➕ Add More Items' },
//       { id: 'cart_checkout', title: '✅ Checkout' },
//       { id: 'cart_clear', title: '🗑️ Clear Cart' }
//     ]
//   );
// };

// /**
//  * Send delivery type selection
//  */
// const sendDeliveryOptions = async (business, waId) => {
//   const fee = business.settings?.deliveryFee ?? 30;
//   return sendWhatsAppButtons(
//     business, waId,
//     '🚚 Choose Delivery Type',
//     `How would you like to receive your order?\n\n🏠 *Home Delivery* — ₹${fee} delivery charge\n🏪 *Self Pickup* — Free, collect from store`,
//     'Select one option',
//     [
//       { id: 'delivery_home', title: '🏠 Home Delivery' },
//       { id: 'delivery_pickup', title: '🏪 Self Pickup' }
//     ]
//   );
// };

// /**
//  * Send payment options
//  */
// const sendPaymentOptions = async (business, waId, summaryText) => {
//   return sendWhatsAppButtons(
//     business, waId,
//     '💳 Choose Payment Method',
//     summaryText,
//     'Select how you\'d like to pay',
//     [
//       { id: 'pay_online', title: '📱 Pay Online (UPI)' },
//       { id: 'pay_cod', title: '💵 Cash on Delivery' }
//     ]
//   );
// };

// // ═══════════════════════════════════════════════════════════════════
// // MAIN HANDLER
// // ═══════════════════════════════════════════════════════════════════
// const handleIncomingMessage = async (provider, businessId, rawMsg) => {
//   try {
//     console.log('🤖 BOT ENGINE CALLED — provider:', provider, 'businessId:', businessId);
//     const parsed = normaliseMessage(provider, rawMsg);
//     console.log('🔄 Normalised message:', JSON.stringify(parsed, null, 2));
//     if (!parsed) {
//       console.log('⚠️ No parsed message — skipping');
//       return;
//     }

//     const { waId, text, location, name, msgId } = parsed;
//     const lowerText = text.toLowerCase().trim();
//     console.log('📱 waId:', waId, '| text:', text, '| hasLocation:', !!location);
//     // Need text OR location to proceed
//     if (!text && !location) return;

//     // ─── Deduplication ───
//     if (msgId) {
//       const isNew = await redis.setnx(`msg_dedup:${msgId}`, '1');
//       if (!isNew) return;
//       await redis.expire(`msg_dedup:${msgId}`, 120);
//     }

//     // ─── Business (cached) ───
//     let business;
//     const cached = await redis.get(`biz:${businessId}`);
//     if (cached) {
//       business = safeParse(cached, null);
//     } else {
//       business = await Business.findById(businessId).lean();
//       if (business) await redis.set(`biz:${businessId}`, JSON.stringify(business), { ex: 300 });
//     }
//     if (!business) return;

//     // ─── Customer upsert ───
//     let customer = await Customer.findOneAndUpdate(
//       { business: businessId, waId },
//       { name: name || 'Customer', phone: waId },
//       { upsert: true, new: true }
//     );

//     // Shorthand reply
//     const reply = (msg) => sendWhatsAppMessage(business, waId, msg);
//     const replyBtns = (...args) => sendWhatsAppButtons(business, waId, ...args);
//     const replyList = (...args) => sendWhatsAppList(business, waId, ...args);

//     // ─── Reset trigger keywords ───
//     const resetTriggers = ['hi', 'hello', 'hey', 'menu', 'start', 'hii', 'hai', 'hy'];
//     if (resetTriggers.includes(lowerText)) {
//       await clearSession(businessId, waId);
//     }

//     // ─── Global cancel ───
//     if (lowerText === 'cancel' || lowerText === 'reset') {
//       await clearSession(businessId, waId);
//       return sendWelcomeMenu(business, waId);
//     }

//     let state = await getState(businessId, waId);

//     // ═══════════════════════════════════════════
//     // ONBOARDING — collect name if first time
//     // ═══════════════════════════════════════════
//     if (state === 'idle' && (!customer.name || customer.name === 'Customer')) {
//       await setState(businessId, waId, 'awaiting_name');
//       return reply(`👋 Welcome to *${business.name}*!\n\nBefore we get started, could you tell us your name?`);
//     }

//     if (state === 'awaiting_name') {
//       if (!text || text.length < 2) return reply('Please type a valid name (at least 2 characters).');
//       customer.name = text;
//       await customer.save();
//       await setState(businessId, waId, 'idle');
//       // Fall through to show welcome
//     }

//     // ═══════════════════════════════════════════
//     // IDLE → show welcome menu
//     // ═══════════════════════════════════════════
//     if (state === 'idle' || state === 'awaiting_name') {
//       await setState(businessId, waId, 'welcome');
//       return sendWelcomeMenu(business, waId);
//     }

//     // ═══════════════════════════════════════════
//     // WELCOME — main menu selection
//     // ═══════════════════════════════════════════
//     if (state === 'welcome') {
//       // Accept both interactive IDs and numeric fallbacks
//       const isBrowse = lowerText === 'menu_browse' || lowerText === '1' || lowerText.includes('browse') || lowerText.includes('menu');
//       const isTrack = lowerText === 'menu_track' || lowerText === '2' || lowerText.includes('track');
//       const isSupport = lowerText === 'menu_support' || lowerText === '3' || lowerText.includes('support') || lowerText.includes('talk');

//       if (isBrowse) {
//         const categories = await Product.distinct('category', { business: businessId, isAvailable: true });
//         if (!categories.length) return reply('😔 Sorry, no products are currently available. Please check back later!');

//         await redis.set(getCatKey(businessId, waId), JSON.stringify(categories), { ex: 3600 });
//         await setState(businessId, waId, 'browsing_categories');

//         return sendCategoryList(business, waId, categories);

//       } else if (isTrack) {
//         const orders = await Order.find({ business: businessId, 'customer.waId': waId })
//           .sort({ createdAt: -1 }).limit(3).lean();

//         if (!orders.length) {
//           return replyBtns(
//             '📦 Order History',
//             'You haven\'t placed any orders yet. Ready to order something delicious?',
//             null,
//             [{ id: 'menu_browse', title: '🛒 Browse Menu' }]
//           );
//         }

//         const statusEmoji = { pending: '🕐', confirmed: '✅', preparing: '👨‍🍳', dispatched: '🚚', delivered: '🎉', cancelled: '❌' };
//         const lines = orders.map(o =>
//           `${statusEmoji[o.status] || '📦'} *${o.orderId}*\nStatus: ${o.status.toUpperCase()} | ₹${o.total}`
//         ).join('\n\n');

//         return replyBtns(
//           '📦 Your Recent Orders',
//           lines,
//           'Showing last 3 orders',
//           [{ id: 'menu_browse', title: '🛒 Order Again' }]
//         );

//       } else if (isSupport) {
//         const phone = business.phone || 'our official number';
//         return replyBtns(
//           '💬 Customer Support',
//           `Need help? Our team is here for you!\n\n📞 *Phone:* ${phone}\n\nOr simply describe your issue and we'll get back to you.`,
//           'Tap below to go back to the main menu',
//           [{ id: 'menu_browse', title: '⬅️ Back to Menu' }]
//         );

//       } else {
//         return sendWelcomeMenu(business, waId);
//       }
//     }

//     // ═══════════════════════════════════════════
//     // BROWSING CATEGORIES
//     // ═══════════════════════════════════════════
//     if (state === 'browsing_categories') {
//       const categories = safeParse(await redis.get(getCatKey(businessId, waId)), []);

//       // Match by interactive list ID (cat_0, cat_1, ...) OR numeric text OR category name
//       let selectedIdx = -1;

//       if (lowerText.startsWith('cat_')) {
//         selectedIdx = parseInt(lowerText.replace('cat_', ''));
//       } else {
//         const num = parseInt(lowerText);
//         if (!isNaN(num) && num > 0 && num <= categories.length) {
//           selectedIdx = num - 1;
//         } else {
//           // Try matching by name
//           selectedIdx = categories.findIndex(c => c.toLowerCase() === lowerText);
//         }
//       }

//       if (selectedIdx >= 0 && selectedIdx < categories.length) {
//         const selectedCat = categories[selectedIdx];
//         const products = await Product.find({
//           business: businessId,
//           category: selectedCat,
//           isAvailable: true
//         }).sort({ sortOrder: 1, name: 1 }).lean();

//         if (!products.length) {
//           return replyBtns(
//             `📂 ${selectedCat}`,
//             'No items are currently available in this category.',
//             'Please try another category',
//             [{ id: 'back_categories', title: '⬅️ Back to Categories' }]
//           );
//         }

//         const itemData = products.map(p => ({
//           _id: p._id,
//           name: p.name,
//           price: p.discountPrice || p.price,
//           images: p.images
//         }));
//         await redis.set(getItemsKey(businessId, waId), JSON.stringify(itemData), { ex: 3600 });
//         await redis.set(`cache:catname:${businessId}:${waId}`, selectedCat, { ex: 3600 });
//         await setState(businessId, waId, 'browsing_items');

//         return sendProductList(business, waId, itemData, selectedCat);

//       } else if (lowerText === 'back_categories' || lowerText === 'back' || lowerText === '0') {
//         await setState(businessId, waId, 'welcome');
//         return sendWelcomeMenu(business, waId);
//       } else {
//         return sendCategoryList(business, waId, categories);
//       }
//     }

//     // ═══════════════════════════════════════════
//     // BROWSING ITEMS
//     // ═══════════════════════════════════════════
//     if (state === 'browsing_items') {
//       const items = safeParse(await redis.get(getItemsKey(businessId, waId)), []);
//       const catName = (await redis.get(`cache:catname:${businessId}:${waId}`)) || 'Items';

//       // Match by item_0, item_1, ... OR numeric OR name
//       let selectedIdx = -1;

//       if (lowerText.startsWith('item_')) {
//         selectedIdx = parseInt(lowerText.replace('item_', ''));
//       } else {
//         const num = parseInt(lowerText);
//         if (!isNaN(num) && num > 0 && num <= items.length) {
//           selectedIdx = num - 1;
//         } else {
//           selectedIdx = items.findIndex(i => i.name.toLowerCase() === lowerText);
//         }
//       }

//       if (lowerText === 'back_categories' || lowerText === 'back' || lowerText === '0') {
//         const categories = safeParse(await redis.get(getCatKey(businessId, waId)), []);
//         if (!categories || categories.length === 0) {
//           await setState(businessId, waId, 'welcome');
//           return sendWelcomeMenu(business, waId);
//         }
//         await setState(businessId, waId, 'browsing_categories');
//         return sendCategoryList(business, waId, categories);
//       }

//       if (lowerText === 'view_cart' || lowerText === 'cart') {
//         const cart = await getCart(businessId, waId);
//         if (!cart.length) return reply('🛒 Your cart is empty. Select an item to add!');
//         await setState(businessId, waId, 'item_added');
//         return sendCartWithActions(business, waId, cart);
//       }

//       if (selectedIdx >= 0 && selectedIdx < items.length) {
//         const selected = items[selectedIdx];
//         const cart = await getCart(businessId, waId);

//         const existing = cart.find(i => i.productId === selected._id.toString());
//         if (existing) existing.quantity += 1;
//         else cart.push({ productId: selected._id.toString(), name: selected.name, price: selected.price, quantity: 1 });

//         await saveCart(businessId, waId, cart);
//         await setState(businessId, waId, 'item_added');

//         const total = cartTotal(cart);
//         const itemCount = cart.reduce((s, i) => s + i.quantity, 0);
//         const caption = `✅ *${selected.name}* added to cart!\n\n🛒 *${itemCount} item${itemCount > 1 ? 's' : ''}* in cart — Total: *₹${total}*`;

//         // Try to send product image
//         const fullProduct = await Product.findById(selected._id).lean();
//         if (fullProduct?.images?.[0]?.url) {
//           await sendProductImage(business, waId, fullProduct, caption);
//         }

//         // Always follow up with action buttons
//         return replyBtns(
//           null,
//           'What would you like to do next?',
//           null,
//           [
//             { id: 'cart_more', title: '➕ Add More Items' },
//             { id: 'view_cart', title: '🛒 View Cart' },
//             { id: 'cart_checkout', title: '✅ Checkout' }
//           ]
//         );
//       } else {
//         return sendProductList(business, waId, items, catName);
//       }
//     }

//     // ═══════════════════════════════════════════
//     // ITEM ADDED — post-add actions
//     // ═══════════════════════════════════════════
//     if (state === 'item_added') {
//       const cart = await getCart(businessId, waId);

//       if (lowerText === 'cart_more' || lowerText === '1' || lowerText.includes('add more')) {
//         const categories = safeParse(await redis.get(getCatKey(businessId, waId)), []);
//         if (categories.length) {
//           await setState(businessId, waId, 'browsing_categories');
//           return sendCategoryList(business, waId, categories);
//         }
//         await setState(businessId, waId, 'welcome');
//         return sendWelcomeMenu(business, waId);

//       } else if (lowerText === 'view_cart' || lowerText === '2' || lowerText.includes('view cart') || lowerText.includes('cart')) {
//         return sendCartWithActions(business, waId, cart);

//       } else if (lowerText === 'cart_checkout' || lowerText === '3' || lowerText.includes('checkout')) {
//         if (!cart.length) return reply('🛒 Your cart is empty!');
//         await setState(businessId, waId, 'checkout_delivery');
//         return sendDeliveryOptions(business, waId);

//       } else if (lowerText === 'cart_clear' || lowerText.includes('clear')) {
//         await redis.del(getCartKey(businessId, waId));
//         return replyBtns(
//           '🗑️ Cart Cleared',
//           'Your cart has been cleared. Start fresh!',
//           null,
//           [{ id: 'menu_browse', title: '🛒 Browse Menu' }]
//         );
//       } else {
//         return sendCartWithActions(business, waId, cart);
//       }
//     }

//     // ═══════════════════════════════════════════
//     // CHECKOUT — DELIVERY TYPE
//     // ═══════════════════════════════════════════
//     if (state === 'checkout_delivery') {
//       const isDelivery = lowerText === 'delivery_home' || lowerText === '1' || lowerText.includes('home') || lowerText.includes('delivery');
//       const isPickup = lowerText === 'delivery_pickup' || lowerText === '2' || lowerText.includes('pickup') || lowerText.includes('self');

//       if (isDelivery) {
//         await setState(businessId, waId, 'checkout_address');
//         return sendLocationRequest(business, waId);

//       } else if (isPickup) {
//         await setLocation(businessId, waId, { type: 'pickup', address: 'Self Pickup' });
//         await setState(businessId, waId, 'checkout_coupon');
//         return replyBtns(
//           '🎟️ Discount Coupon',
//           'Do you have a discount coupon code?\n\nType your code below, or tap *Skip* if you don\'t have one.',
//           null,
//           [{ id: 'coupon_skip', title: '⏭️ Skip Coupon' }]
//         );
//       } else {
//         return sendDeliveryOptions(business, waId);
//       }
//     }

//     // ═══════════════════════════════════════════
//     // CHECKOUT — ADDRESS (location or text)
//     // ═══════════════════════════════════════════
//     if (state === 'checkout_address') {
//       // User tapped "Type Address" button
//       if (lowerText === 'type_address_manually') {
//         return reply('✏️ Please type your full delivery address:');
//       }

//       if (!text && !location) {
//         return sendLocationRequest(business, waId);
//       }

//       let addrStr = '';

//       if (location) {
//         // Shared location pin (live or current)
//         let fullAddress = location.address || '';
//         if (!fullAddress && location.lat && location.lng) {
//           fullAddress = await reverseGeocode(location.lat, location.lng);
//         }
//         addrStr = fullAddress || `📍 Lat: ${location.lat}, Lng: ${location.lng}`;
//         await setLocation(businessId, waId, { ...location, address: addrStr, type: 'delivery' });

//         // Confirm the detected address with user
//         await replyBtns(
//           '📍 Location Received',
//           `We detected your address as:\n\n*${addrStr}*\n\nIs this correct?`,
//           null,
//           [
//             { id: 'addr_confirm', title: '✅ Yes, Confirm' },
//             { id: 'addr_retype', title: '✏️ Enter Manually' }
//           ]
//         );
//         await setState(businessId, waId, 'confirm_address');
//         return;

//       } else if (text) {
//         // Manually typed address
//         addrStr = text;
//         await setLocation(businessId, waId, { address: addrStr, type: 'delivery' });
//         await setState(businessId, waId, 'checkout_coupon');
//         return replyBtns(
//           '🎟️ Discount Coupon',
//           `📍 *Address saved:* ${addrStr}\n\nDo you have a discount coupon code?`,
//           null,
//           [{ id: 'coupon_skip', title: '⏭️ Skip Coupon' }]
//         );
//       }
//     }

//     // ═══════════════════════════════════════════
//     // CONFIRM ADDRESS (after location pin)
//     // ═══════════════════════════════════════════
//     if (state === 'confirm_address') {
//       if (lowerText === 'addr_confirm' || lowerText === 'yes' || lowerText.includes('confirm')) {
//         await setState(businessId, waId, 'checkout_coupon');
//         return replyBtns(
//           '🎟️ Discount Coupon',
//           'Do you have a discount coupon code?\n\nType your code below, or tap *Skip*.',
//           null,
//           [{ id: 'coupon_skip', title: '⏭️ Skip Coupon' }]
//         );
//       } else if (lowerText === 'addr_retype' || lowerText === 'no' || lowerText.includes('manual')) {
//         await setState(businessId, waId, 'checkout_address');
//         return reply('✏️ Please type your full delivery address:');
//       } else {
//         const locData = await getLocation(businessId, waId);
//         return replyBtns(
//           '📍 Confirm Address',
//           `Detected address:\n*${locData?.address || 'Unknown'}*\n\nIs this correct?`,
//           null,
//           [
//             { id: 'addr_confirm', title: '✅ Yes, Confirm' },
//             { id: 'addr_retype', title: '✏️ Enter Manually' }
//           ]
//         );
//       }
//     }

//     // ═══════════════════════════════════════════
//     // CHECKOUT — COUPON
//     // ═══════════════════════════════════════════
//     if (state === 'checkout_coupon') {
//       const cart = await getCart(businessId, waId);
//       const subtotal = cartTotal(cart);

//       const isSkip = lowerText === 'coupon_skip' || lowerText === 'skip' || lowerText === 'no';

//       let discount = 0;
//       let couponCode = '';
//       let couponApplied = false;

//       if (!isSkip) {
//         const coupon = await Coupon.findOne({
//           business: businessId,
//           code: text.toUpperCase(),
//           isActive: true
//         });

//         if (!coupon) {
//           return replyBtns(
//             '❌ Invalid Coupon',
//             `The coupon code *${text.toUpperCase()}* is not valid or has expired.\n\nTry another code, or skip.`,
//             null,
//             [{ id: 'coupon_skip', title: '⏭️ Skip Coupon' }]
//           );
//         }

//         if (subtotal < coupon.minOrderValue) {
//           return replyBtns(
//             '⚠️ Minimum Order Not Met',
//             `This coupon requires a minimum order of *₹${coupon.minOrderValue}*.\nYour subtotal is ₹${subtotal}.\n\nAdd more items or skip.`,
//             null,
//             [
//               { id: 'cart_more', title: '➕ Add Items' },
//               { id: 'coupon_skip', title: '⏭️ Skip Coupon' }
//             ]
//           );
//         }

//         couponCode = coupon.code;
//         discount = coupon.discountType === 'percentage'
//           ? (subtotal * coupon.discountValue) / 100
//           : coupon.discountValue;
//         if (coupon.maxDiscount && discount > coupon.maxDiscount) discount = coupon.maxDiscount;
//         couponApplied = true;

//         await redis.set(getCouponKey(businessId, waId), JSON.stringify({
//           code: coupon.code,
//           type: coupon.discountType,
//           value: coupon.discountValue,
//           max: coupon.maxDiscount
//         }), { ex: 3600 });
//       }

//       // Build order summary
//       const locData = await getLocation(businessId, waId);
//       const isDelivery = locData?.type === 'delivery';
//       const fee = business.settings?.deliveryFee ?? 30;
//       const deliveryFee = isDelivery ? fee : 0;
//       const total = subtotal + deliveryFee - discount;

//       const cartLines = cart.map(i => `• ${i.name} ×${i.quantity} = ₹${i.price * i.quantity}`).join('\n');

//       let summaryText = `🧾 *Order Summary*\n\n${cartLines}\n\n`;
//       summaryText += `Subtotal: ₹${subtotal}\n`;
//       summaryText += `Delivery: ₹${deliveryFee}`;
//       if (couponApplied) summaryText += `\n🎟️ Discount (${couponCode}): -₹${discount.toFixed(0)}`;
//       summaryText += `\n\n*💰 Total: ₹${total.toFixed(0)}*`;
//       summaryText += `\n📍 ${locData?.address || 'Self Pickup'}`;

//       await setState(businessId, waId, 'checkout_payment');

//       return sendPaymentOptions(business, waId, summaryText);
//     }

//     // ═══════════════════════════════════════════
//     // CHECKOUT — PAYMENT
//     // ═══════════════════════════════════════════
//     if (state === 'checkout_payment') {
//       const cart = await getCart(businessId, waId);
//       if (!cart.length) {
//         await setState(businessId, waId, 'idle');
//         return reply('⏰ Your cart has expired. Let\'s start over!');
//       }

//       const isOnline = lowerText === 'pay_online' || lowerText === '1' || lowerText.includes('online') || lowerText.includes('upi');
//       const isCOD = lowerText === 'pay_cod' || lowerText === '2' || lowerText.includes('cash') || lowerText.includes('cod');

//       if (!isOnline && !isCOD) {
//         const locData = await getLocation(businessId, waId);
//         const subtotal = cartTotal(cart);
//         const isDelivery = locData?.type === 'delivery';
//         const fee = business.settings?.deliveryFee ?? 30;
//         const deliveryFee = isDelivery ? fee : 0;
//         const couponRaw = await redis.get(getCouponKey(businessId, waId));
//         let discount = 0;
//         if (couponRaw) {
//           const c = JSON.parse(couponRaw);
//           discount = c.type === 'percentage' ? (subtotal * c.value) / 100 : c.value;
//           if (c.max && discount > c.max) discount = c.max;
//         }
//         const total = subtotal + deliveryFee - discount;
//         return sendPaymentOptions(business, waId, `💰 *Total: ₹${total.toFixed(0)}*\n\nChoose payment method:`);
//       }

//       // ── Process Order ──
//       const locData = await getLocation(businessId, waId);
//       const subtotal = cartTotal(cart);
//       const isDelivery = locData?.type === 'delivery';
//       const fee = business.settings?.deliveryFee ?? 30;
//       const deliveryFee = isDelivery ? fee : 0;

//       let discount = 0;
//       let couponCode = '';
//       const couponRaw = await redis.get(getCouponKey(businessId, waId));
//       if (couponRaw) {
//         const c = JSON.parse(couponRaw);
//         couponCode = c.code;
//         discount = c.type === 'percentage' ? (subtotal * c.value) / 100 : c.value;
//         if (c.max && discount > c.max) discount = c.max;
//       }

//       const total = subtotal + deliveryFee - discount;

//       const order = await Order.create({
//         business: businessId,
//         orderId: generateOrderId(),
//         customer: { name: customer.name, phone: waId, waId },
//         items: cart.map(i => ({
//           product: i.productId,
//           name: i.name,
//           price: i.price,
//           quantity: i.quantity,
//           total: i.price * i.quantity
//         })),
//         subtotal,
//         deliveryCharge: deliveryFee,
//         discount,
//         couponCode,
//         total,
//         deliveryAddress: locData?.address || (isDelivery ? 'Location Pin' : 'Self Pickup'),
//         deliveryType: isDelivery ? 'delivery' : 'pickup',
//         paymentMethod: isOnline ? 'online' : 'cod',
//         status: 'pending',
//         statusHistory: [{ status: 'pending' }],
//       });

//       await Customer.updateOne(
//         { business: businessId, waId },
//         { $inc: { totalOrders: 1, totalSpent: total }, $set: { lastOrderAt: new Date() } }
//       );

//       if (couponCode) {
//         await Coupon.findOneAndUpdate(
//           { business: businessId, code: couponCode },
//           { $inc: { usedCount: 1 } }
//         );
//       }

//       await clearSession(businessId, waId);

//       if (isOnline) {
//         // Send payment link first, then confirmation
//         await reply(`🔗 *Payment Link:*\nhttps://rzp.io/i/dummy${order.orderId}\n\n_Complete payment within 10 minutes to confirm your order._`);
//       }

//       return replyBtns(
//         `🎉 Order Placed!`,
//         `Your order *#${order.orderId}* has been placed successfully!\n\n⏱️ Estimated time: *30–40 minutes*\n\nThank you for ordering from *${business.name}*! 🙏`,
//         'Reply "hi" anytime to order again',
//         [{ id: 'menu_track', title: '📦 Track My Order' }]
//       );
//     }

//     // ─── Default fallback ───
//     await clearSession(businessId, waId);
//     await setState(businessId, waId, 'welcome');
//     return sendWelcomeMenu(business, waId);

//   } catch (err) {
//     console.error('BOT ERROR:', err);
//   }
// };

// module.exports = { handleIncomingMessage };





















/**
 * OneServe Bot Engine — botEngine.js
 * Clean state machine for WhatsApp ordering flow.
 * Supports Meta Cloud API, Baileys, WPPConnect.
 *
 * ORDER FLOW:
 * idle → welcome → browsing_categories → browsing_items
 *      → item_added → checkout_delivery → checkout_address
 *      → confirm_address → checkout_coupon → checkout_payment → DONE
 */

const Business = require('../models/Business');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const Coupon = require('../models/Coupon');
const { redis } = require('../config/rediss');
const { v4: uuidv4 } = require('uuid');

const {
  sendWhatsAppMessage,
  sendWhatsAppButtons,
  sendWhatsAppList,
  sendProductImage,
  sendLocationRequest,
  sendWelcomeMenu,
} = require('./whatsappService');

// ─────────────────────────────────────────────
// REDIS KEY HELPERS
// ─────────────────────────────────────────────
const K = {
  cart: (b, w) => `cart:${b}:${w}`,
  state: (b, w) => `state:${b}:${w}`,
  loc: (b, w) => `loc:${b}:${w}`,
  cats: (b, w) => `cats:${b}:${w}`,
  items: (b, w) => `items:${b}:${w}`,
  catName: (b, w) => `catname:${b}:${w}`,
  coupon: (b, w) => `coupon:${b}:${w}`,
  biz: (b) => `biz:${b}`,
  dedup: (id) => `dedup:${id}`,
};

const TTL = { session: 3600, biz: 300, dedup: 120 };

// ─────────────────────────────────────────────
// REDIS HELPERS
// ─────────────────────────────────────────────
const safeParse = (raw, fallback) => {
  if (!raw) return fallback;
  try { return typeof raw === 'string' ? JSON.parse(raw) : raw; }
  catch { return fallback; }
};

const getCart = async (b, w) => safeParse(await redis.get(K.cart(b, w)), []);
const saveCart = async (b, w, cart) => redis.set(K.cart(b, w), JSON.stringify(cart), { ex: TTL.session });
const getState = async (b, w) => (await redis.get(K.state(b, w))) || 'idle';
const setState = async (b, w, s) => redis.set(K.state(b, w), s, { ex: TTL.session });
const setLoc = async (b, w, d) => redis.set(K.loc(b, w), JSON.stringify(d), { ex: TTL.session });
const getLoc = async (b, w) => safeParse(await redis.get(K.loc(b, w)), null);

const clearSession = (b, w) => Promise.all([
  redis.del(K.cart(b, w)),
  redis.del(K.state(b, w)),
  redis.del(K.loc(b, w)),
  redis.del(K.cats(b, w)),
  redis.del(K.items(b, w)),
  redis.del(K.catName(b, w)),
  redis.del(K.coupon(b, w)),
]);

const generateOrderId = () =>
  `ORD-${Date.now().toString(36).toUpperCase()}-${uuidv4().slice(0, 4).toUpperCase()}`;

// ─────────────────────────────────────────────
// CART HELPERS
// ─────────────────────────────────────────────
const cartTotal = (cart) =>
  cart.reduce((s, i) => s + i.price * i.quantity, 0);

const cartSummaryLines = (cart) =>
  cart.map((i, idx) => `${idx + 1}. ${i.name} ×${i.quantity} — ₹${i.price * i.quantity}`).join('\n');

// ─────────────────────────────────────────────
// REVERSE GEOCODE
// ─────────────────────────────────────────────
const reverseGeocode = async (lat, lng) => {
  try {
    const axios = require('axios');
    const { data } = await axios.get(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
      { headers: { 'User-Agent': 'OneServeBot/1.0' }, timeout: 5000 }
    );
    return data?.display_name || '';
  } catch {
    return '';
  }
};

// ─────────────────────────────────────────────
// MESSAGE NORMALISER  →  { waId, text, location, name, msgId }
// ─────────────────────────────────────────────
const normaliseMessage = (provider, raw) => {
  try {
    if (provider === 'meta') {
      const msg = raw.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
      const contact = raw.entry?.[0]?.changes?.[0]?.value?.contacts?.[0];
      if (!msg) return null;

      let text = '', location = null;

      if (msg.type === 'text') {
        text = msg.text?.body || '';
      } else if (msg.type === 'interactive') {
        const ir = msg.interactive;
        text = ir?.list_reply?.id
          || ir?.button_reply?.id
          || ir?.list_reply?.title
          || ir?.button_reply?.title
          || '';
      } else if (msg.type === 'location') {
        location = {
          lat: msg.location.latitude,
          lng: msg.location.longitude,
          address: msg.location.address || msg.location.name || '',
        };
      }

      return {
        waId: msg.from,
        text: text.trim(),
        location,
        name: contact?.profile?.name || 'Customer',
        msgId: msg.id,
      };
    }

    if (provider === 'baileys') {
      const waId = (rawMsg.key?.remoteJid || '').replace('@s.whatsapp.net', '');
      if (!waId || waId.includes('broadcast')) return null;

      let text = raw.message?.conversation
        || raw.message?.extendedTextMessage?.text
        || raw.message?.buttonsResponseMessage?.selectedButtonId
        || raw.message?.listResponseMessage?.singleSelectReply?.selectedRowId
        || '';
      let location = null;

      const locMsg = raw.message?.locationMessage || raw.message?.liveLocationMessage;
      if (locMsg) {
        location = {
          lat: locMsg.degreesLatitude,
          lng: locMsg.degreesLongitude,
          address: locMsg.address || '',
        };
        text = '';
      }

      return { waId, text: text.trim(), location, name: raw.pushName || 'Customer', msgId: raw.key?.id };
    }

    if (provider === 'wppconnect') {
      const waId = (raw.from || '').replace('@c.us', '');
      if (!waId) return null;

      let text = raw.body?.trim() || '';
      let location = null;

      if (raw.type === 'location' || raw.type === 'live_location') {
        location = { lat: raw.lat, lng: raw.lng, address: raw.loc || '' };
        text = '';
      } else if (raw.type === 'buttons_response' || raw.type === 'list_response') {
        text = raw.selectedButtonId || raw.selectedRowId || raw.body || '';
      }

      return { waId, text, location, name: raw.sender?.pushname || 'Customer', msgId: raw.id };
    }
  } catch (err) {
    console.error('Normaliser error:', err.message);
  }
  return null;
};

// ─────────────────────────────────────────────
// RICH UI SENDERS
// ─────────────────────────────────────────────

/** Welcome list (Meta) or buttons (Baileys/WPP) */
const showWelcome = (business, waId) =>
  sendWelcomeMenu(business, waId);

/** Category picker */
const showCategories = (business, waId, categories) =>
  sendWhatsAppList(
    business, waId,
    '🛍️ Shop by Category',
    'Choose a category to browse:',
    'Reply *0* to go back',
    '📂 Pick Category',
    [{
      title: 'Categories', rows: categories.map((c, i) => ({
        id: `cat_${i}`,
        title: c.substring(0, 24),
        description: `Browse ${c} items`,
      }))
    }]
  );

/** Product list — buttons for ≤3 items, list for more */
const showProducts = (business, waId, products, catName) => {
  if (products.length <= 3) {
    return sendWhatsAppButtons(
      business, waId,
      `🍽️ ${catName}`,
      products.map((p, i) =>
        `*${i + 1}.* ${p.name}\n💰 ₹${p.price}${p.description ? `\n_${p.description.substring(0, 60)}_` : ''}`
      ).join('\n\n'),
      'Tap a button to add to cart',
      products.slice(0, 3).map((p, i) => ({ id: `item_${i}`, title: p.name.substring(0, 20) }))
    );
  }
  return sendWhatsAppList(
    business, waId,
    `🍽️ ${catName}`,
    `Items available in *${catName}*. Tap to add to cart:`,
    'Reply *0* to go back to categories',
    '🛒 Select Item',
    [{
      title: catName, rows: products.map((p, i) => ({
        id: `item_${i}`,
        title: p.name.substring(0, 24),
        description: `₹${p.price}${p.description ? ' • ' + p.description.substring(0, 48) : ''}`,
      }))
    }]
  );
};

/** Cart with action buttons */
const showCart = (business, waId, cart) => {
  const total = cartTotal(cart);
  return sendWhatsAppButtons(
    business, waId,
    `🛒 Your Cart — ₹${total}`,
    cart.length
      ? cartSummaryLines(cart)
      : 'Your cart is empty.',
    'What would you like to do?',
    [
      { id: 'cart_more', title: '➕ Add More Items' },
      { id: 'cart_checkout', title: '✅ Checkout' },
      { id: 'cart_clear', title: '🗑️ Clear Cart' },
    ]
  );
};

/** Delivery type */
const showDeliveryOptions = (business, waId) => {
  const fee = business.settings?.deliveryFee ?? 30;
  return sendWhatsAppButtons(
    business, waId,
    '🚚 Delivery Type',
    `🏠 *Home Delivery* — ₹${fee} charge\n🏪 *Self Pickup* — Free`,
    'Choose one',
    [
      { id: 'delivery_home', title: '🏠 Home Delivery' },
      { id: 'delivery_pickup', title: '🏪 Self Pickup' },
    ]
  );
};

/** Coupon Prompt */
const showCouponsPrompt = async (business, waId, prefixText = '') => {
  const coupons = await Coupon.find({ business: business._id, isActive: true }).lean();
  if (!coupons.length) {
    return sendWhatsAppButtons(
      business, waId,
      '🎟️ Discount Coupon',
      `${prefixText ? prefixText + '\n\n' : ''}Have a discount coupon? Type the code below, or tap Skip.`,
      null,
      [{ id: 'coupon_skip', title: '⏭️ Skip' }]
    );
  }

  const textBody = `${prefixText ? prefixText + '\n\n' : ''}*Available Coupons:*\n` +
    coupons.map(c => `🏷️ *${c.code}*: ${c.discountType === 'percentage' ? c.discountValue + '%' : '₹' + c.discountValue} OFF (Min: ₹${c.minOrderValue})`).join('\n') +
    '\n\nType the code, or tap Skip.';

  const buttons = [];
  if (coupons.length <= 2) {
    coupons.forEach(c => buttons.push({ id: `cpn_${c.code.toLowerCase()}`, title: c.code }));
  }
  buttons.push({ id: 'coupon_skip', title: '⏭️ Skip' });

  return sendWhatsAppButtons(
    business, waId,
    '🎟️ Discount Coupon',
    textBody,
    null,
    buttons
  );
};

/** Build and show order summary + payment options */
const showPaymentOptions = async (business, waId, cart, locData, couponData) => {
  const subtotal = cartTotal(cart);
  const isDelivery = locData?.type === 'delivery';
  const fee = business.settings?.deliveryFee ?? 30;
  const deliveryFee = isDelivery ? fee : 0;

  let discount = 0, couponCode = '';
  if (couponData) {
    couponCode = couponData.code;
    discount = couponData.type === 'percentage'
      ? (subtotal * couponData.value) / 100
      : couponData.value;
    if (couponData.max && discount > couponData.max) discount = couponData.max;
  }

  const total = subtotal + deliveryFee - discount;
  const cartLines = cart.map(i => `• ${i.name} ×${i.quantity} = ₹${i.price * i.quantity}`).join('\n');
  const deliveryTx = isDelivery
    ? `📍 ${locData.address}`
    : '🏪 Self Pickup';

  let summary = `🧾 *Order Summary*\n\n${cartLines}\n\n`;
  summary += `Subtotal : ₹${subtotal}\n`;
  summary += `Delivery : ₹${deliveryFee}`;
  if (discount > 0) summary += `\n🎟️ Discount (${couponCode}) : -₹${discount.toFixed(0)}`;
  summary += `\n\n*💰 Total : ₹${total.toFixed(0)}*`;
  summary += `\n${deliveryTx}`;

  return sendWhatsAppButtons(
    business, waId,
    '💳 Choose Payment',
    summary,
    'Select payment method',
    [
      { id: 'pay_online', title: '📱 Pay Online (UPI)' },
      { id: 'pay_cod', title: '💵 Cash on Delivery' },
    ]
  );
};

// ─────────────────────────────────────────────
// MAIN HANDLER
// ─────────────────────────────────────────────
const handleIncomingMessage = async (provider, businessId, rawMsg) => {
  try {
    const parsed = normaliseMessage(provider, rawMsg);
    if (!parsed) return;

    const { waId, text, location, name, msgId } = parsed;
    const lower = text.toLowerCase().trim();

    // Must have text or location
    if (!text && !location) return;

    // ── Atomic deduplication — two layers ──
    // Layer 1: message-level (same msgId never processed twice)
    if (msgId) {
      const isNew = await redis.set(K.dedup(msgId), '1', { nx: true, ex: TTL.dedup });
      if (!isNew) {
        console.log('⚠️ Duplicate msgId dropped:', msgId);
        return;
      }
    }
    // Layer 2: action-level lock (waId + text combo, 5s window)
    // Prevents race when Meta delivers the same button press twice with different msgIds
    const actionKey = `lock:${businessId}:${waId}:${lower.substring(0, 30)}`;
    const actionNew = await redis.set(actionKey, '1', { nx: true, ex: 5 });
    if (!actionNew) {
      console.log('⚠️ Duplicate action dropped:', lower);
      return;
    }

    // ── Load business (cached 5 min) ──
    let business = safeParse(await redis.get(K.biz(businessId)), null);
    if (!business) {
      business = await Business.findById(businessId).lean();
      if (!business) return;
      await redis.set(K.biz(businessId), JSON.stringify(business), { ex: TTL.biz });
    }

    // ── Upsert customer ──
    const customer = await Customer.findOneAndUpdate(
      { business: businessId, waId },
      { $setOnInsert: { name: name || 'Customer', phone: waId } },
      { upsert: true, new: true }
    );

    // Shorthand senders
    const reply = (msg) => sendWhatsAppMessage(business, waId, msg);
    const replyBtns = (...args) => sendWhatsAppButtons(business, waId, ...args);

    // ── Reset triggers ──
    const resets = ['hi', 'hello', 'hey', 'menu', 'start', 'hii', 'hai'];
    if (resets.includes(lower)) {
      await clearSession(businessId, waId);
    }

    // ── Global cancel ──
    if (lower === 'cancel' || lower === 'reset' || lower === '0') {
      await clearSession(businessId, waId);
      await setState(businessId, waId, 'welcome');
      return showWelcome(business, waId);
    }

    let state = await getState(businessId, waId);

    // ── Strict Idle Check ──
    // If the bot is idle, it should ONLY wake up if the user explicitly uses a trigger word.
    // This prevents Meta from sending messages for arbitrary events/status updates.
    if (state === 'idle' && !resets.includes(lower)) {
      console.log(`⚠️ User ${waId} sent non-trigger word while idle. Ignoring.`);
      return;
    }

    // ══════════════════════════════════════════
    // ONBOARDING
    // ══════════════════════════════════════════
    if (state === 'idle' && (!customer.name || customer.name === 'Customer')) {
      await setState(businessId, waId, 'awaiting_name');
      return reply(`👋 Welcome to *${business.name}*!\n\nWhat's your name?`);
    }

    if (state === 'awaiting_name') {
      if (!text || text.length < 2) return reply('Please type a valid name.');
      await Customer.updateOne({ _id: customer._id }, { name: text });
      await setState(businessId, waId, 'welcome');
      return showWelcome(business, waId);
    }

    // ══════════════════════════════════════════
    // IDLE / WELCOME
    // ══════════════════════════════════════════
    if (state === 'idle') {
      await setState(businessId, waId, 'welcome');
      return showWelcome(business, waId);
    }

    if (state === 'welcome') {
      const isBrowse = lower === 'menu_browse' || lower === '1' || lower === 'menu' || lower.includes('browse') || lower.includes('order');
      const isTrack = lower === 'menu_track' || lower === '2' || lower.includes('track');
      const isSupport = lower === 'menu_support' || lower === '3' || lower.includes('support') || lower.includes('talk') || lower.includes('help');

      if (isBrowse) {
        const categories = await Product.distinct('category', { business: businessId, isAvailable: true });
        if (!categories.length) return reply('😔 No products available right now. Check back soon!');

        await redis.set(K.cats(businessId, waId), JSON.stringify(categories), { ex: TTL.session });
        await setState(businessId, waId, 'browsing_categories');
        return showCategories(business, waId, categories);

      } else if (isTrack) {
        const orders = await Order.find({ business: businessId, 'customer.waId': waId })
          .sort({ createdAt: -1 }).limit(3).lean();

        if (!orders.length) {
          return replyBtns('📦 No Orders Yet', 'You haven\'t placed any orders yet.', null,
            [{ id: 'menu_browse', title: '🛒 Browse Menu' }]);
        }

        const emoji = { pending: '🕐', confirmed: '✅', preparing: '👨‍🍳', dispatched: '🚚', delivered: '🎉', cancelled: '❌' };
        const lines = orders.map(o =>
          `${emoji[o.status] || '📦'} *${o.orderId}*\n${o.status.toUpperCase()} — ₹${o.total}`
        ).join('\n\n');

        return replyBtns('📦 Recent Orders', lines, 'Last 3 orders',
          [{ id: 'menu_browse', title: '🛒 Order Again' }]);

      } else if (isSupport) {
        return replyBtns('💬 Support',
          `📞 *${business.phone || 'Contact us for help'}*\n\nOr describe your issue and we\'ll get back to you.`,
          null, [{ id: 'menu_browse', title: '⬅️ Back to Menu' }]);

      } else {
        return showWelcome(business, waId);
      }
    }

    // ══════════════════════════════════════════
    // BROWSING CATEGORIES
    // ══════════════════════════════════════════
    if (state === 'browsing_categories') {
      const categories = safeParse(await redis.get(K.cats(businessId, waId)), []);

      // Back
      if (['back', '0', 'back_categories'].includes(lower)) {
        await setState(businessId, waId, 'welcome');
        return showWelcome(business, waId);
      }

      // Resolve selection: cat_0 / cat_1 OR number OR name match
      let idx = -1;
      if (lower.startsWith('cat_')) idx = parseInt(lower.replace('cat_', ''));
      else if (/^\d+$/.test(lower)) idx = parseInt(lower) - 1;
      else idx = categories.findIndex(c => c.toLowerCase() === lower);

      if (idx < 0 || idx >= categories.length) return showCategories(business, waId, categories);

      const catName = categories[idx];
      const products = await Product.find({ business: businessId, category: catName, isAvailable: true })
        .sort({ sortOrder: 1, name: 1 }).lean();

      if (!products.length) {
        return replyBtns(`📂 ${catName}`, 'No items available in this category.', null,
          [{ id: 'back_categories', title: '⬅️ Back' }]);
      }

      const itemData = products.map(p => ({
        _id: p._id,
        name: p.name,
        price: p.discountPrice || p.price,
        description: p.description,
        images: p.images,
      }));

      await redis.set(K.items(businessId, waId), JSON.stringify(itemData), { ex: TTL.session });
      await redis.set(K.catName(businessId, waId), catName, { ex: TTL.session });
      await setState(businessId, waId, 'browsing_items');
      return showProducts(business, waId, itemData, catName);
    }

    // ══════════════════════════════════════════
    // BROWSING ITEMS
    // ══════════════════════════════════════════
    if (state === 'browsing_items') {
      const items = safeParse(await redis.get(K.items(businessId, waId)), []);
      const catName = (await redis.get(K.catName(businessId, waId))) || 'Items';

      // Back to categories
      if (['back', '0', 'back_categories'].includes(lower)) {
        const categories = safeParse(await redis.get(K.cats(businessId, waId)), []);
        await setState(businessId, waId, 'browsing_categories');
        return categories.length
          ? showCategories(business, waId, categories)
          : showWelcome(business, waId);
      }

      // View cart shortcut
      if (['cart', 'view_cart', 'my cart'].includes(lower)) {
        const cart = await getCart(businessId, waId);
        if (!cart.length) return reply('🛒 Your cart is empty. Select an item to add!');
        await setState(businessId, waId, 'item_added');
        return showCart(business, waId, cart);
      }

      // Resolve item selection
      let idx = -1;
      if (lower.startsWith('item_')) idx = parseInt(lower.replace('item_', ''));
      else if (/^\d+$/.test(lower)) idx = parseInt(lower) - 1;
      else idx = items.findIndex(i => i.name.toLowerCase() === lower);

      if (idx < 0 || idx >= items.length) return showProducts(business, waId, items, catName);

      // Add to cart
      const selected = items[idx];
      const cart = await getCart(businessId, waId);
      const existing = cart.find(i => i.productId === selected._id.toString());

      if (existing) existing.quantity += 1;
      else cart.push({
        productId: selected._id.toString(),
        name: selected.name,
        price: selected.price,
        quantity: 1,
      });

      await saveCart(businessId, waId, cart);
      await setState(businessId, waId, 'item_added');

      const total = cartTotal(cart);
      const itemCount = cart.reduce((s, i) => s + i.quantity, 0);
      const caption = `✅ *${selected.name}* added!\n🛒 ${itemCount} item${itemCount > 1 ? 's' : ''} — Total: *₹${total}*`;

      // Send product image if available
      if (selected.images?.[0]?.url) {
        await sendProductImage(business, waId, selected, caption);
      } else {
        await reply(caption);
      }

      // Follow-up action buttons
      return replyBtns(
        null,
        'What would you like to do next?',
        null,
        [
          { id: 'cart_more', title: '➕ Add More' },
          { id: 'view_cart', title: '🛒 View Cart' },
          { id: 'cart_checkout', title: '✅ Checkout' },
        ]
      );
    }

    // ══════════════════════════════════════════
    // ITEM ADDED — post-add actions
    // ══════════════════════════════════════════
    if (state === 'item_added') {
      const cart = await getCart(businessId, waId);

      const isMore = lower === 'cart_more' || lower === '1' || lower === 'add more' || lower === 'more';
      const isCheckout = lower === 'cart_checkout' || lower === '3' || lower === 'checkout';
      const isClear = lower === 'cart_clear' || lower === 'clear';
      const isViewCart = lower === 'view_cart' || lower === '2' || lower === 'cart';

      if (isMore) {
        const categories = safeParse(await redis.get(K.cats(businessId, waId)), []);
        await setState(businessId, waId, 'browsing_categories');
        return categories.length
          ? showCategories(business, waId, categories)
          : showWelcome(business, waId);

      } else if (isViewCart) {
        return showCart(business, waId, cart);

      } else if (isCheckout) {
        if (!cart.length) return reply('🛒 Your cart is empty!');
        await setState(businessId, waId, 'checkout_delivery');
        return showDeliveryOptions(business, waId);

      } else if (isClear) {
        await redis.del(K.cart(businessId, waId));
        return replyBtns('🗑️ Cart Cleared', 'Start fresh!', null,
          [{ id: 'menu_browse', title: '🛒 Browse Menu' }]);

      } else {
        return showCart(business, waId, cart);
      }
    }

    // ══════════════════════════════════════════
    // CHECKOUT — DELIVERY TYPE
    // ══════════════════════════════════════════
    if (state === 'checkout_delivery') {
      const isHome = lower === 'delivery_home' || lower === '1' || lower.includes('home');
      const isPickup = lower === 'delivery_pickup' || lower === '2' || lower.includes('pickup') || lower.includes('self');

      if (isHome) {
        await setState(businessId, waId, 'checkout_address');
        return sendLocationRequest(business, waId);

      } else if (isPickup) {
        await setLoc(businessId, waId, { type: 'pickup', address: 'Self Pickup' });
        await setState(businessId, waId, 'checkout_coupon');
        return showCouponsPrompt(business, waId);
      } else {
        return showDeliveryOptions(business, waId);
      }
    }

    // ══════════════════════════════════════════
    // CHECKOUT — ADDRESS INPUT
    // ══════════════════════════════════════════
    if (state === 'checkout_address') {
      if (!text && !location) return sendLocationRequest(business, waId);

      if (location) {
        let addr = location.address || '';
        if (!addr) addr = await reverseGeocode(location.lat, location.lng);
        addr = addr || `📍 ${location.lat}, ${location.lng}`;

        await setLoc(businessId, waId, { ...location, address: addr, type: 'delivery' });
        await setState(businessId, waId, 'confirm_address');

        return replyBtns(
          '📍 Confirm Address',
          `We detected:\n\n*${addr}*\n\nIs this correct?`,
          null,
          [
            { id: 'addr_confirm', title: '✅ Confirm' },
            { id: 'addr_retype', title: '✏️ Type Manually' },
          ]
        );
      }

      // Typed address
      await setLoc(businessId, waId, { address: text, type: 'delivery' });
      await setState(businessId, waId, 'checkout_coupon');
      return showCouponsPrompt(business, waId, `📍 *Saved:* ${text}`);
    }

    // ══════════════════════════════════════════
    // CHECKOUT — CONFIRM ADDRESS
    // ══════════════════════════════════════════
    if (state === 'confirm_address') {
      const isConfirm = lower === 'addr_confirm' || lower === '1' || lower === 'yes' || lower.includes('confirm');
      const isRetype = lower === 'addr_retype' || lower === '2' || lower === 'no' || lower.includes('manual') || lower.includes('type');

      if (isConfirm) {
        await setState(businessId, waId, 'checkout_coupon');
        return showCouponsPrompt(business, waId);
      } else if (isRetype) {
        await setState(businessId, waId, 'checkout_address');
        return reply('✏️ Please type your full delivery address:');
      } else {
        const locData = await getLoc(businessId, waId);
        return replyBtns(
          '📍 Confirm Address',
          `Detected:\n*${locData?.address || 'Unknown'}*\n\nIs this correct?`,
          null,
          [
            { id: 'addr_confirm', title: '✅ Confirm' },
            { id: 'addr_retype', title: '✏️ Type Manually' },
          ]
        );
      }
    }

    // ══════════════════════════════════════════
    // CHECKOUT — COUPON
    // ══════════════════════════════════════════
    if (state === 'checkout_coupon') {
      const cart = await getCart(businessId, waId);
      const subtotal = cartTotal(cart);
      const isSkip = ['coupon_skip', 'skip', 'no', 'none'].includes(lower);

      let couponData = null;

      if (!isSkip) {
        let couponInput = text.toUpperCase();
        if (lower.startsWith('cpn_')) {
          couponInput = lower.replace('cpn_', '').toUpperCase();
        }

        const coupon = await Coupon.findOne({
          business: businessId,
          code: couponInput,
          isActive: true,
        });

        if (!coupon) {
          return replyBtns('❌ Invalid Coupon',
            `*${text.toUpperCase()}* is not valid or expired. Try another or skip.`,
            null, [{ id: 'coupon_skip', title: '⏭️ Skip' }]);
        }

        if (subtotal < (coupon.minOrderValue || 0)) {
          return replyBtns('⚠️ Min Order Not Met',
            `This coupon needs a min order of ₹${coupon.minOrderValue}.\nYour subtotal: ₹${subtotal}.`,
            null,
            [
              { id: 'cart_more', title: '➕ Add Items' },
              { id: 'coupon_skip', title: '⏭️ Skip' },
            ]);
        }

        couponData = {
          code: coupon.code,
          type: coupon.discountType,
          value: coupon.discountValue,
          max: coupon.maxDiscount,
        };
        await redis.set(K.coupon(businessId, waId), JSON.stringify(couponData), { ex: TTL.session });
      }

      const locData = await getLoc(businessId, waId);
      await setState(businessId, waId, 'checkout_payment');
      return showPaymentOptions(business, waId, cart, locData, couponData);
    }

    // ══════════════════════════════════════════
    // CHECKOUT — PAYMENT
    // ══════════════════════════════════════════
    if (state === 'checkout_payment') {
      const isOnline = lower === 'pay_online' || lower === '1' || lower.includes('online') || lower.includes('upi');
      const isCOD = lower === 'pay_cod' || lower === '2' || lower.includes('cash') || lower.includes('cod');

      if (!isOnline && !isCOD) {
        // Re-show payment options
        const cart = await getCart(businessId, waId);
        const locData = await getLoc(businessId, waId);
        const cpnRaw = await redis.get(K.coupon(businessId, waId));
        return showPaymentOptions(business, waId, cart, locData, safeParse(cpnRaw, null));
      }

      const cart = await getCart(businessId, waId);
      if (!cart.length) {
        await clearSession(businessId, waId);
        return reply('⏰ Cart expired. Send *hi* to start again.');
      }

      const locData = await getLoc(businessId, waId);
      const subtotal = cartTotal(cart);
      const isDelivery = locData?.type === 'delivery';
      const fee = business.settings?.deliveryFee ?? 30;
      const deliveryFee = isDelivery ? fee : 0;

      const cpnRaw = await redis.get(K.coupon(businessId, waId));
      const cpnData = safeParse(cpnRaw, null);
      let discount = 0, couponCode = '';

      if (cpnData) {
        couponCode = cpnData.code;
        discount = cpnData.type === 'percentage'
          ? (subtotal * cpnData.value) / 100
          : cpnData.value;
        if (cpnData.max && discount > cpnData.max) discount = cpnData.max;
      }

      const total = subtotal + deliveryFee - discount;

      // Create order
      const order = await Order.create({
        business: businessId,
        orderId: generateOrderId(),
        customer: { name: customer.name, phone: waId, waId },
        items: cart.map(i => ({
          product: i.productId,
          name: i.name,
          price: i.price,
          quantity: i.quantity,
          total: i.price * i.quantity,
        })),
        subtotal,
        deliveryCharge: deliveryFee,
        discount,
        couponCode,
        total,
        deliveryAddress: locData?.address || 'Self Pickup',
        deliveryType: isDelivery ? 'delivery' : 'pickup',
        paymentMethod: isOnline ? 'online' : 'cod',
        status: 'pending',
        statusHistory: [{ status: 'pending', timestamp: new Date() }],
      });

      // Update customer stats
      await Customer.updateOne(
        { _id: customer._id },
        { $inc: { totalOrders: 1, totalSpent: total }, $set: { lastOrderAt: new Date() } }
      );

      // Increment coupon usage
      if (couponCode) {
        await Coupon.updateOne(
          { business: businessId, code: couponCode },
          { $inc: { usedCount: 1 } }
        );
      }

      await clearSession(businessId, waId);

      // Send payment link first if online
      if (isOnline) {
        await reply(
          `🔗 *Payment Link:*\nhttps://rzp.io/i/${order.orderId}\n\n_Complete payment within 10 minutes._`
        );
      }

      return replyBtns(
        '🎉 Order Placed!',
        `*#${order.orderId}* confirmed!\n\n⏱️ ETA: 30–40 min\n\nThank you for ordering from *${business.name}*! 🙏`,
        'Send *hi* anytime to order again',
        [{ id: 'menu_track', title: '📦 Track Order' }]
      );
    }

    // ── Fallback ──
    await clearSession(businessId, waId);
    await setState(businessId, waId, 'welcome');
    return showWelcome(business, waId);

  } catch (err) {
    console.error('BOT ERROR:', err.message, err.stack);
  }
};

module.exports = { handleIncomingMessage };