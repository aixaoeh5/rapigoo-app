const { logger, securityLogger, businessLogger } = require('../utils/logger');

const monitoringMetrics = {
  requests: {
    total: 0,
    byMethod: {},
    byStatus: {},
    byEndpoint: {}
  },
  performance: {
    totalResponseTime: 0,
    slowRequests: 0,
    errors: 0
  },
  security: {
    authFailures: 0,
    rateLimitExceeded: 0,
    suspiciousActivity: 0
  },
  business: {
    registrations: 0,
    orders: 0,
    payments: 0
  }
};

const metricsCollector = () => {
  return (req, res, next) => {
    const startTime = process.hrtime.bigint();
    const originalEnd = res.end;
    
    monitoringMetrics.requests.total++;
    
    const method = req.method;
    monitoringMetrics.requests.byMethod[method] = (monitoringMetrics.requests.byMethod[method] || 0) + 1;
    
    const endpoint = req.route?.path || req.path;
    monitoringMetrics.requests.byEndpoint[endpoint] = (monitoringMetrics.requests.byEndpoint[endpoint] || 0) + 1;
    
    res.end = function(...args) {
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000;
      
      monitoringMetrics.requests.byStatus[res.statusCode] = (monitoringMetrics.requests.byStatus[res.statusCode] || 0) + 1;
      
      monitoringMetrics.performance.totalResponseTime += duration;
      
      if (duration > 1000) {
        monitoringMetrics.performance.slowRequests++;
      }
      
      if (res.statusCode >= 400) {
        monitoringMetrics.performance.errors++;
      }
      
      originalEnd.apply(this, args);
    };
    
    next();
  };
};

const alerting = {
  thresholds: {
    errorRate: 0.05, // 5%
    avgResponseTime: 2000, // 2 seconds
    slowRequestRate: 0.1, // 10%
    memoryUsage: 0.8, // 80%
    cpuUsage: 0.8 // 80%
  },
  
  checks: {
    errorRate: () => {
      const total = monitoringMetrics.requests.total;
      const errors = monitoringMetrics.performance.errors;
      return total > 0 ? errors / total : 0;
    },
    
    avgResponseTime: () => {
      const total = monitoringMetrics.requests.total;
      return total > 0 ? monitoringMetrics.performance.totalResponseTime / total : 0;
    },
    
    slowRequestRate: () => {
      const total = monitoringMetrics.requests.total;
      const slow = monitoringMetrics.performance.slowRequests;
      return total > 0 ? slow / total : 0;
    },
    
    memoryUsage: () => {
      const usage = process.memoryUsage();
      return usage.heapUsed / usage.heapTotal;
    }
  },
  
  evaluate: () => {
    const alerts = [];
    
    Object.entries(alerting.checks).forEach(([metric, checkFn]) => {
      const value = checkFn();
      const threshold = alerting.thresholds[metric];
      
      if (value > threshold) {
        alerts.push({
          metric,
          value,
          threshold,
          severity: value > threshold * 1.5 ? 'critical' : 'warning',
          timestamp: new Date().toISOString()
        });
      }
    });
    
    return alerts;
  },
  
  notify: (alerts) => {
    alerts.forEach(alert => {
      logger.warn('Performance Alert', alert);
      
      if (alert.severity === 'critical') {
        logger.error('Critical Performance Alert', alert);
      }
    });
  }
};

const healthMetrics = () => {
  const memoryUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();
  const uptime = process.uptime();
  
  return {
    timestamp: new Date().toISOString(),
    uptime: Math.floor(uptime),
    memory: {
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      rss: Math.round(memoryUsage.rss / 1024 / 1024),
      external: Math.round(memoryUsage.external / 1024 / 1024)
    },
    cpu: {
      user: cpuUsage.user,
      system: cpuUsage.system
    },
    process: {
      pid: process.pid,
      version: process.version,
      platform: process.platform
    },
    requests: monitoringMetrics.requests,
    performance: {
      ...monitoringMetrics.performance,
      avgResponseTime: monitoringMetrics.requests.total > 0 ? 
        monitoringMetrics.performance.totalResponseTime / monitoringMetrics.requests.total : 0
    },
    security: monitoringMetrics.security,
    business: monitoringMetrics.business
  };
};

const errorTracking = (err, req, res, next) => {
  const errorInfo = {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection.remoteAddress,
    userId: req.user?.id
  };
  
  logger.error('Application Error', errorInfo);
  
  monitoringMetrics.performance.errors++;
  
  if (process.env.NODE_ENV === 'production') {
    // Aquí se puede integrar con servicios como Sentry
    console.error('Production Error:', errorInfo);
  }
  
  next(err);
};

const businessMetricsCollector = {
  userRegistered: (req, res, next) => {
    if (req.method === 'POST' && req.path.includes('/auth/register')) {
      res.on('finish', () => {
        if (res.statusCode === 201) {
          monitoringMetrics.business.registrations++;
          businessLogger.userRegistered(res.locals.userId, req.body.userType);
        }
      });
    }
    next();
  },
  
  orderCreated: (req, res, next) => {
    if (req.method === 'POST' && req.path.includes('/orders')) {
      res.on('finish', () => {
        if (res.statusCode === 201) {
          monitoringMetrics.business.orders++;
          businessLogger.orderCreated(
            res.locals.orderId,
            req.user?.id,
            req.body.merchantId,
            req.body.total
          );
        }
      });
    }
    next();
  },
  
  paymentProcessed: (req, res, next) => {
    if (req.method === 'POST' && req.path.includes('/payment')) {
      res.on('finish', () => {
        if (res.statusCode === 200) {
          monitoringMetrics.business.payments++;
          businessLogger.paymentProcessed(
            res.locals.paymentId,
            req.body.orderId,
            req.body.amount,
            req.body.method,
            'completed'
          );
        }
      });
    }
    next();
  }
};

const securityMonitoring = {
  authFailure: (req, reason) => {
    monitoringMetrics.security.authFailures++;
    securityLogger.authFailure(req, reason);
  },
  
  rateLimitExceeded: (req) => {
    monitoringMetrics.security.rateLimitExceeded++;
    securityLogger.rateLimitExceeded(req);
  },
  
  suspiciousActivity: (req, activity) => {
    monitoringMetrics.security.suspiciousActivity++;
    securityLogger.suspiciousActivity(req, activity);
  }
};

const realTimeMonitoring = {
  start: () => {
    setInterval(() => {
      const metrics = healthMetrics();
      logger.info('Health Metrics', metrics);
      
      const alerts = alerting.evaluate();
      if (alerts.length > 0) {
        alerting.notify(alerts);
      }
    }, 60000); // Cada minuto
    
    setInterval(() => {
      logger.info('Current Metrics', {
        requests: monitoringMetrics.requests.total,
        errors: monitoringMetrics.performance.errors,
        avgResponseTime: monitoringMetrics.requests.total > 0 ? 
          monitoringMetrics.performance.totalResponseTime / monitoringMetrics.requests.total : 0
      });
    }, 300000); // Cada 5 minutos
  }
};

const metricsEndpoint = (req, res) => {
  const metrics = healthMetrics();
  const alerts = alerting.evaluate();
  
  res.json({
    ...metrics,
    alerts
  });
};

const resetMetrics = () => {
  monitoringMetrics.requests = {
    total: 0,
    byMethod: {},
    byStatus: {},
    byEndpoint: {}
  };
  monitoringMetrics.performance = {
    totalResponseTime: 0,
    slowRequests: 0,
    errors: 0
  };
  monitoringMetrics.security = {
    authFailures: 0,
    rateLimitExceeded: 0,
    suspiciousActivity: 0
  };
  monitoringMetrics.business = {
    registrations: 0,
    orders: 0,
    payments: 0
  };
};

module.exports = {
  metricsCollector,
  errorTracking,
  businessMetricsCollector,
  securityMonitoring,
  realTimeMonitoring,
  metricsEndpoint,
  healthMetrics,
  alerting,
  resetMetrics
};