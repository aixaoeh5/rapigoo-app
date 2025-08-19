const redis = require('redis');

class CacheService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.init();
  }

  async init() {
    try {
      // Solo intentar conectar a Redis si está configurado explícitamente
      if (process.env.REDIS_URL && process.env.REDIS_URL !== 'redis://localhost:6379') {
        const redisUrl = process.env.REDIS_URL;
        this.client = redis.createClient({
          url: redisUrl,
          password: process.env.REDIS_PASSWORD,
          db: process.env.REDIS_DB || 0,
          socket: {
            connectTimeout: 5000,
            lazyConnect: true
          }
        });

        this.client.on('error', (err) => {
          console.warn('Redis Client Error (falling back to memory cache):', err.message);
          this.isConnected = false;
        });

        this.client.on('connect', () => {
          console.log('Redis connected successfully');
          this.isConnected = true;
        });

        this.client.on('ready', () => {
          console.log('Redis ready for operations');
          this.isConnected = true;
        });

        try {
          await Promise.race([
            this.client.connect(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Redis connection timeout')), 3000))
          ]);
        } catch (error) {
          console.warn('Redis connection failed, using memory cache:', error.message);
          this.isConnected = false;
          this.client = null;
        }
      } else {
        console.log('Redis not configured, using memory cache');
        this.isConnected = false;
      }
    } catch (error) {
      console.warn('Failed to initialize Redis, using memory cache:', error.message);
      this.isConnected = false;
      this.client = null;
    }
  }

  async get(key) {
    if (!this.isConnected || !this.client) {
      return null;
    }
    
    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  async set(key, value, ttl = 3600) {
    if (!this.isConnected || !this.client) {
      return false;
    }

    try {
      await this.client.setEx(key, ttl, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('Cache set error:', error);
      return false;
    }
  }

  async del(key) {
    if (!this.isConnected || !this.client) {
      return false;
    }

    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      console.error('Cache delete error:', error);
      return false;
    }
  }

  async delPattern(pattern) {
    if (!this.isConnected || !this.client) {
      return false;
    }

    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
      }
      return true;
    } catch (error) {
      console.error('Cache delete pattern error:', error);
      return false;
    }
  }

  async exists(key) {
    if (!this.isConnected || !this.client) {
      return false;
    }

    try {
      const exists = await this.client.exists(key);
      return exists === 1;
    } catch (error) {
      console.error('Cache exists error:', error);
      return false;
    }
  }

  async ttl(key) {
    if (!this.isConnected || !this.client) {
      return -1;
    }

    try {
      return await this.client.ttl(key);
    } catch (error) {
      console.error('Cache TTL error:', error);
      return -1;
    }
  }

  async incr(key, ttl = 3600) {
    if (!this.isConnected || !this.client) {
      return 0;
    }

    try {
      const result = await this.client.incr(key);
      if (result === 1) {
        await this.client.expire(key, ttl);
      }
      return result;
    } catch (error) {
      console.error('Cache increment error:', error);
      return 0;
    }
  }

  generateKey(prefix, ...parts) {
    return `${prefix}:${parts.join(':')}`;
  }

  async disconnect() {
    if (this.client) {
      await this.client.disconnect();
      this.isConnected = false;
    }
  }
}

const cacheService = new CacheService();

const cache = (options = {}) => {
  const {
    ttl = 3600,
    keyGenerator = null,
    condition = null,
    tags = []
  } = options;

  return async (req, res, next) => {
    if (req.method !== 'GET') {
      return next();
    }

    if (condition && !condition(req)) {
      return next();
    }

    const key = keyGenerator ? 
      keyGenerator(req) : 
      cacheService.generateKey('api', req.originalUrl, JSON.stringify(req.query));

    try {
      const cached = await cacheService.get(key);
      if (cached) {
        res.set('X-Cache', 'HIT');
        return res.json(cached);
      }

      res.set('X-Cache', 'MISS');

      const originalJson = res.json;
      res.json = function(data) {
        if (res.statusCode === 200 && data.success) {
          cacheService.set(key, data, ttl).catch(console.error);
        }
        return originalJson.call(this, data);
      };

      next();
    } catch (error) {
      console.error('Cache middleware error:', error);
      next();
    }
  };
};

const invalidateCache = (patterns) => {
  return async (req, res, next) => {
    const originalJson = res.json;
    res.json = function(data) {
      const result = originalJson.call(this, data);
      
      if (['POST', 'PUT', 'DELETE'].includes(req.method) && res.statusCode < 400) {
        patterns.forEach(pattern => {
          cacheService.delPattern(pattern).catch(console.error);
        });
      }
      
      return result;
    };
    
    next();
  };
};

const cacheKeyGenerators = {
  merchants: (req) => {
    const { category, rating, search, lat, lng, radius } = req.query;
    return cacheService.generateKey('merchants', category || 'all', rating || '0', search || '', lat || '', lng || '', radius || '');
  },
  
  services: (req) => {
    const { merchantId, category, available, minPrice, maxPrice } = req.query;
    return cacheService.generateKey('services', merchantId || 'all', category || 'all', available || 'all', minPrice || '0', maxPrice || '999999');
  },
  
  search: (req) => {
    const { q, type, category, lat, lng, radius } = req.query;
    return cacheService.generateKey('search', q, type || 'all', category || 'all', lat || '', lng || '', radius || '');
  },
  
  merchant: (req) => {
    return cacheService.generateKey('merchant', req.params.id);
  }
};

const cachePresets = {
  merchants: cache({
    ttl: 300,
    keyGenerator: cacheKeyGenerators.merchants,
    condition: (req) => !req.user
  }),
  
  services: cache({
    ttl: 600,
    keyGenerator: cacheKeyGenerators.services
  }),
  
  search: cache({
    ttl: 180,
    keyGenerator: cacheKeyGenerators.search
  }),
  
  merchant: cache({
    ttl: 900,
    keyGenerator: cacheKeyGenerators.merchant
  }),
  
  static: cache({
    ttl: 3600
  }),
  
  short: cache({
    ttl: 60
  })
};

const cacheInvalidation = {
  merchants: invalidateCache(['api:merchants:*', 'api:search:*']),
  services: invalidateCache(['api:services:*', 'api:search:*', 'api:merchant:*']),
  merchant: (merchantId) => invalidateCache([`api:merchant:${merchantId}`, 'api:merchants:*'])
};

module.exports = {
  cache,
  cacheService,
  invalidateCache,
  cachePresets,
  cacheInvalidation,
  cacheKeyGenerators
};