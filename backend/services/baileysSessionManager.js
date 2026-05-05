// const {
//   default: makeWASocket,
//   DisconnectReason,
//   useMultiFileAuthState,
//   fetchLatestBaileysVersion,
//   makeCacheableSignalKeyStore,
//   isJidBroadcast,
// } = require('@whiskeysockets/baileys');
// const path = require('path');
// const fs = require('fs');
// const { redis } = require('../config/rediss');
// const pino = require('pino');

// const sessions = new Map();
// const SESSION_DIR = path.join(__dirname, '../../sessions/baileys');

// if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true });

// const getSessionPath = (businessId) => path.join(SESSION_DIR, businessId);

// const logger = pino({ level: 'silent' });

// const createBaileysSession = async (businessId, onQR, onConnected, onDisconnected) => {
//   const sessionPath = getSessionPath(businessId);
//   const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
//   const { version } = await fetchLatestBaileysVersion();

//   const sock = makeWASocket({
//     version,
//     auth: {
//       creds: state.creds,
//       keys: makeCacheableSignalKeyStore(state.keys, logger),
//     },
//     logger,
//     printQRInTerminal: false,
//     browser: ['OneServe', 'Chrome', '120.0.0'],
//     syncFullHistory: false,
//     generateHighQualityLinkPreview: false,
//     shouldIgnoreJid: jid => isJidBroadcast(jid),
//   });

//   sock.ev.on('creds.update', saveCreds);

//   sock.ev.on('connection.update', async (update) => {
//     const { connection, lastDisconnect, qr } = update;

//     if (qr) {
//       try {
//         // const redis = getRedis();
//         await redis.setex(`wa:qr:${businessId}`, 60, qr);
//         if (onQR) onQR(qr);
//       } catch (e) { console.error('Redis QR save error:', e.message); }
//     }

//     if (connection === 'open') {
//       sessions.set(businessId, sock);
//       try {
//         const redis = getRedis();
//         await redis.set(`wa:connected:${businessId}`, '1');
//         await redis.del(`wa:qr:${businessId}`);
//       } catch {}
//       if (onConnected) onConnected(sock.user);
//       console.log(`✅ Baileys connected for business ${businessId}`);
//     }

//     if (connection === 'close') {
//       const statusCode = lastDisconnect?.error?.output?.statusCode;
//       sessions.delete(businessId);
//       try {
//         const redis = getRedis();
//         await redis.del(`wa:connected:${businessId}`);
//       } catch {}

//       const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
//       console.log(`Baileys disconnected [${businessId}] code=${statusCode} reconnect=${shouldReconnect}`);

//       if (shouldReconnect) {
//         setTimeout(() => {
//           createBaileysSession(businessId, onQR, onConnected, onDisconnected).catch(console.error);
//         }, 5000);
//       } else {
//         fs.rmSync(sessionPath, { recursive: true, force: true });
//         if (onDisconnected) onDisconnected();
//       }
//     }
//   });

//   sock.ev.on('messages.upsert', async ({ messages, type }) => {
//     if (type !== 'notify') return;
//     for (const msg of messages) {
//       if (msg.key.fromMe) continue;
//       if (isJidBroadcast(msg.key.remoteJid || '')) continue;
//       try {
//         const { handleIncomingMessage } = require('./botEngine');
//         await handleIncomingMessage('baileys', businessId, msg);
//       } catch (err) {
//         console.error('Bot engine error:', err.message);
//       }
//     }
//   });

//   return sock;
// };

// const getWASocket = (businessId) => sessions.get(businessId) || null;

// const disconnectBaileys = async (businessId) => {
//   const sock = sessions.get(businessId);
//   if (sock) {
//     try { await sock.logout(); } catch {}
//     sessions.delete(businessId);
//   }
//   const sessionPath = getSessionPath(businessId);
//   fs.rmSync(sessionPath, { recursive: true, force: true });
//   try {
//     const redis = getRedis();
//     await redis.del(`wa:connected:${businessId}`);
//   } catch {}
// };

// const restoreAllSessions = async () => {
//   if (!fs.existsSync(SESSION_DIR)) return;
//   const dirs = fs.readdirSync(SESSION_DIR);
//   for (const businessId of dirs) {
//     console.log(`Restoring Baileys session for ${businessId}`);
//     createBaileysSession(businessId, null, null, null).catch(console.error);
//   }
// };

// module.exports = { createBaileysSession, getWASocket, disconnectBaileys, restoreAllSessions };








const {
  default: makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');

const path = require('path');
const fs = require('fs');
const { redis } = require('../config/rediss');
const pino = require('pino');

const sessions = new Map();

const SESSION_DIR = path.join(__dirname, '../../sessions/baileys');
if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true });

const getSessionPath = (businessId) => path.join(SESSION_DIR, businessId);
const logger = pino({ level: 'silent' });

// 🚀 CREATE SESSION
const createBaileysSession = async (businessId, onQR, onConnected, onDisconnected) => {
  const sessionPath = getSessionPath(businessId);

  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger,
  });

  sock.ev.on('creds.update', saveCreds);

  // 🔗 CONNECTION HANDLING
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    // ✅ QR
    if (qr) {
      console.log("📲 QR RECEIVED");

      await redis.set(`wa:qr:${businessId}`, qr, { ex: 60 });

      if (onQR) await onQR(qr);
    }

    // ✅ CONNECTED
    if (connection === 'open') {
      console.log("✅ WhatsApp connected:", businessId);

      sessions.set(String(businessId), sock);

      await redis.set(`wa:connected:${businessId}`, '1');
      await redis.del(`wa:qr:${businessId}`);

      if (onConnected) await onConnected(sock.user);
    }

    // ❌ DISCONNECTED
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;

      console.log("❌ Disconnected:", code);

      sessions.delete(String(businessId));
      await redis.del(`wa:connected:${businessId}`);

      const shouldReconnect = code !== DisconnectReason.loggedOut;

      if (shouldReconnect) {
        setTimeout(() => {
          createBaileysSession(businessId, onQR, onConnected, onDisconnected);
        }, 5000);
      } else {
        fs.rmSync(sessionPath, { recursive: true, force: true });

        if (onDisconnected) onDisconnected();
      }
    }
  });

  // 🔥🔥🔥 IMPORTANT: INCOMING MESSAGE LISTENER
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    try {
      console.log("📩 EVENT:", type);

      if (type !== 'notify') return;

      for (const msg of messages) {
        console.log("📨 RAW MESSAGE:", JSON.stringify(msg, null, 2));

        // ignore your own messages
        if (msg.key.fromMe) continue;

        const jid = msg.key.remoteJid;
        console.log("📱 From:", jid);

        // 🔥 CALL BOT ENGINE
        const { handleIncomingMessage } = require('./botEngine');

        await handleIncomingMessage('baileys', businessId, msg);
      }

    } catch (err) {
      console.error("❌ messages.upsert error:", err.message);
    }
  });

  return sock;
};

// 🔍 GET SOCKET
const getWASocket = (businessId) => {
  return sessions.get(String(businessId)) || null;
};

// ❌ DISCONNECT
const disconnectBaileys = async (businessId) => {
  const sock = sessions.get(String(businessId));

  if (sock) {
    try { await sock.logout(); } catch {}
    sessions.delete(String(businessId));
  }

  await redis.del(`wa:connected:${businessId}`);
};

// 🔁 RESTORE SESSIONS
const restoreAllSessions = async () => {
  if (!fs.existsSync(SESSION_DIR)) return;

  const dirs = fs.readdirSync(SESSION_DIR);

  for (const businessId of dirs) {
    console.log("🔄 Restoring session:", businessId);
    createBaileysSession(businessId, null, null, null);
  }
};

module.exports = {
  createBaileysSession,
  getWASocket,
  disconnectBaileys,
  restoreAllSessions,
};