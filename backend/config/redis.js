const Redis = require('ioredis');

let redis;

const connectRedis = () => {
  redis = new Redis({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    retryStrategy: (times) => Math.min(times * 100, 3000),
    lazyConnect: false,
  });

  redis.on('connect', () => console.log('✅ Redis connected'));
  redis.on('error', (err) => console.error('❌ Redis error:', err.message));
  redis.on('reconnecting', () => console.log('🔄 Redis reconnecting...'));
};

const getRedis = () => {
  if (!redis) throw new Error('Redis not initialised. Call connectRedis() first.');
  return redis;
};

module.exports = connectRedis;
module.exports.getRedis = getRedis;
