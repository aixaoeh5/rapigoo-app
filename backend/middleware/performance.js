const cluster = require('cluster');
const os = require('os');

const performanceMonitor = () => {
  return (req, res, next) => {
    const startTime = process.hrtime.bigint();
    const startMemory = process.memoryUsage();
    
    res.on('finish', () => {
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000;
      const endMemory = process.memoryUsage();
      
      const memoryDelta = {
        rss: endMemory.rss - startMemory.rss,
        heapUsed: endMemory.heapUsed - startMemory.heapUsed,
        heapTotal: endMemory.heapTotal - startMemory.heapTotal,
        external: endMemory.external - startMemory.external
      };
      
      // Solo establecer headers si la respuesta no ha sido enviada
      if (!res.headersSent) {
        res.set({
          'X-Response-Time': `${duration.toFixed(2)}ms`,
          'X-Memory-Usage': `${(endMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`,
          'X-Process-ID': process.pid
        });
      }
      
      if (duration > 1000) {
        console.warn(`Slow request detected: ${req.method} ${req.originalUrl} - ${duration.toFixed(2)}ms`);
      }
      
      if (memoryDelta.heapUsed > 50 * 1024 * 1024) {
        console.warn(`High memory usage detected: ${req.method} ${req.originalUrl} - ${(memoryDelta.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      }
    });
    
    next();
  };
};

const optimizeQueries = () => {
  return (req, res, next) => {
    const originalQuery = req.query;
    
    if (originalQuery.limit) {
      const limit = parseInt(originalQuery.limit);
      req.query.limit = Math.min(Math.max(limit, 1), 100);
    } else {
      req.query.limit = 20;
    }
    
    if (originalQuery.page) {
      const page = parseInt(originalQuery.page);
      req.query.page = Math.max(page, 1);
    } else {
      req.query.page = 1;
    }
    
    if (originalQuery.search && originalQuery.search.length > 100) {
      req.query.search = originalQuery.search.substring(0, 100);
    }
    
    next();
  };
};

const resourceLimit = (options = {}) => {
  const {
    maxRequests = 1000,
    windowMs = 60000,
    maxMemoryMB = 512,
    maxConcurrent = 100
  } = options;
  
  let requestCount = 0;
  let concurrentRequests = 0;
  let windowStart = Date.now();
  
  return (req, res, next) => {
    const now = Date.now();
    
    if (now - windowStart > windowMs) {
      requestCount = 0;
      windowStart = now;
    }
    
    requestCount++;
    concurrentRequests++;
    
    const memoryUsage = process.memoryUsage();
    const memoryMB = memoryUsage.heapUsed / 1024 / 1024;
    
    if (requestCount > maxRequests) {
      return res.status(429).json({
        success: false,
        error: {
          message: 'Too many requests in time window',
          code: 'RATE_LIMIT_EXCEEDED'
        }
      });
    }
    
    if (concurrentRequests > maxConcurrent) {
      concurrentRequests--;
      return res.status(503).json({
        success: false,
        error: {
          message: 'Server too busy, try again later',
          code: 'SERVER_BUSY'
        }
      });
    }
    
    if (memoryMB > maxMemoryMB) {
      concurrentRequests--;
      return res.status(503).json({
        success: false,
        error: {
          message: 'Server memory limit reached',
          code: 'MEMORY_LIMIT'
        }
      });
    }
    
    res.on('finish', () => {
      concurrentRequests--;
    });
    
    res.on('close', () => {
      concurrentRequests--;
    });
    
    next();
  };
};

const databaseOptimization = () => {
  return (req, res, next) => {
    if (req.mongoQuery) {
      if (!req.mongoQuery.options) {
        req.mongoQuery.options = {};
      }
      
      if (req.query.limit) {
        req.mongoQuery.options.limit = parseInt(req.query.limit);
      }
      
      if (req.query.page) {
        const page = parseInt(req.query.page);
        req.mongoQuery.options.skip = (page - 1) * (req.mongoQuery.options.limit || 20);
      }
      
      if (req.query.sort) {
        const [field, direction] = req.query.sort.split(':');
        req.mongoQuery.options.sort = {
          [field]: direction === 'desc' ? -1 : 1
        };
      }
      
      req.mongoQuery.options.lean = true;
      
      if (req.query.fields) {
        const fields = req.query.fields.split(',').join(' ');
        req.mongoQuery.options.select = fields;
      }
    }
    
    next();
  };
};

const preloadData = (preloaders = {}) => {
  return async (req, res, next) => {
    try {
      const preloadPromises = [];
      
      for (const [key, preloader] of Object.entries(preloaders)) {
        if (typeof preloader === 'function') {
          preloadPromises.push(
            preloader(req).then(data => ({ key, data }))
          );
        }
      }
      
      const results = await Promise.allSettled(preloadPromises);
      req.preloaded = {};
      
      results.forEach(result => {
        if (result.status === 'fulfilled') {
          req.preloaded[result.value.key] = result.value.data;
        }
      });
      
      next();
    } catch (error) {
      console.error('Preload error:', error);
      next();
    }
  };
};

const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

const batchProcessor = (options = {}) => {
  const {
    batchSize = 10,
    delay = 100,
    timeout = 5000
  } = options;
  
  const batches = new Map();
  
  return (req, res, next) => {
    const batchKey = req.originalUrl;
    
    if (!batches.has(batchKey)) {
      batches.set(batchKey, {
        requests: [],
        timer: null,
        processing: false
      });
    }
    
    const batch = batches.get(batchKey);
    batch.requests.push({ req, res, next });
    
    if (batch.requests.length >= batchSize || !batch.timer) {
      if (batch.timer) {
        clearTimeout(batch.timer);
      }
      
      batch.timer = setTimeout(() => {
        processBatch(batchKey, batch);
      }, delay);
    }
    
    setTimeout(() => {
      if (!res.headersSent) {
        res.status(408).json({
          success: false,
          error: {
            message: 'Request timeout',
            code: 'TIMEOUT'
          }
        });
      }
    }, timeout);
  };
  
  function processBatch(batchKey, batch) {
    if (batch.processing) return;
    
    batch.processing = true;
    const requests = [...batch.requests];
    batch.requests = [];
    
    requests.forEach(({ req, res, next }) => {
      if (!res.headersSent) {
        next();
      }
    });
    
    batch.processing = false;
    
    if (batch.requests.length === 0) {
      batches.delete(batchKey);
    }
  }
};

const healthCheck = () => {
  const startTime = Date.now();
  
  return (req, res, next) => {
    if (req.path === '/health') {
      const memoryUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      const uptime = Date.now() - startTime;
      
      const health = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(uptime / 1000),
        memory: {
          heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          rss: Math.round(memoryUsage.rss / 1024 / 1024)
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system
        },
        pid: process.pid
      };
      
      if (cluster.worker) {
        health.worker = cluster.worker.id;
      }
      
      return res.json(health);
    }
    
    next();
  };
};

module.exports = {
  performanceMonitor,
  optimizeQueries,
  resourceLimit,
  databaseOptimization,
  preloadData,
  asyncHandler,
  batchProcessor,
  healthCheck
};