const { Redis } = require("@upstash/redis");

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const connectRedis = async () => {
  try {
    await redis.ping();
    console.log("✅ Redis connected");
  } catch (err) {
    console.error("❌ Redis error:", err.message);
  }
};

module.exports = { redis, connectRedis };