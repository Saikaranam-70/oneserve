const { create, defaultLogger } = require('@wppconnect-team/wppconnect');
const path = require('path');
const { redis } = require('../config/rediss');

const clients = new Map();
const SESSION_DIR = path.join(__dirname, '../../sessions/wpp');

const createWPPSession = async (businessId, onQR, onConnected, onDisconnected) => {
  try {
    const client = await create({
      session: businessId,
      folderNameToken: SESSION_DIR,
      catchQR: async (base64Qr, asciiQR, attempts, urlCode) => {
        // const redis = getRedis();
        await redis.setex(`wa:qr:${businessId}`, 60, base64Qr);
        if (onQR) onQR(base64Qr);
      },
      statusFind: async (statusSession, session) => {
        console.log(`WPP status [${session}]: ${statusSession}`);
        // const redis = getRedis();
        if (['isLogged', 'qrReadSuccess', 'chatsAvailable'].includes(statusSession)) {
          clients.set(businessId, client);
          await redis.set(`wa:connected:${businessId}`, '1');
          if (onConnected) onConnected();
        }
        if (['notLogged', 'desconnectedMobile', 'deleteToken'].includes(statusSession)) {
          clients.delete(businessId);
          await redis.del(`wa:connected:${businessId}`);
          if (onDisconnected) onDisconnected();
        }
      },
      headless: 'new',
      devtools: false,
      useChrome: false,
      debug: false,
      logQR: false,
      browserArgs: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
      ],
      autoClose: 0,
      tokenStore: 'file',
      logger: defaultLogger,
    });

    clients.set(businessId, client);

    client.onMessage(async (message) => {
      if (message.fromMe) return;
      try {
        const { handleIncomingMessage } = require('./botEngine');
        await handleIncomingMessage('wppconnect', businessId, message);
      } catch (err) {
        console.error('WPP bot engine error:', err.message);
      }
    });

    return client;
  } catch (err) {
    console.error(`WPP session create error [${businessId}]:`, err.message);
    throw err;
  }
};

const getWPPClient = (businessId) => clients.get(businessId) || null;

const disconnectWPP = async (businessId) => {
  const client = clients.get(businessId);
  if (client) {
    try { await client.logout(); } catch { }
    try { await client.close(); } catch { }
    clients.delete(businessId);
  }
  try {
    // const redis = getRedis();
    await redis.del(`wa:connected:${businessId}`);
  } catch { }
};

module.exports = { createWPPSession, getWPPClient, disconnectWPP };
