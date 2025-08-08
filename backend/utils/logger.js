const winston = require('winston');
const path = require('path');

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`;
    }
    
    if (stack) {
      log += `\n${stack}`;
    }
    
    return log;
  })
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports: []
});

if (process.env.NODE_ENV === 'production') {
  logger.add(new winston.transports.File({
    filename: path.join(process.cwd(), 'logs', 'error.log'),
    level: 'error',
    maxsize: 10 * 1024 * 1024,
    maxFiles: 5,
    tailable: true
  }));
  
  logger.add(new winston.transports.File({
    filename: path.join(process.cwd(), 'logs', 'combined.log'),
    maxsize: 10 * 1024 * 1024,
    maxFiles: 5,
    tailable: true
  }));
} else {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      logFormat
    )
  }));
}

const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logData = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress
    };
    
    if (req.user) {
      logData.userId = req.user.id;
    }
    
    if (res.statusCode >= 400) {
      logger.warn('HTTP Request', logData);
    } else {
      logger.info('HTTP Request', logData);
    }
  });
  
  res.on('error', (error) => {
    logger.error('HTTP Response Error', {
      method: req.method,
      url: req.originalUrl,
      error: error.message,
      stack: error.stack
    });
  });
  
  next();
};

const errorLogger = (err, req, res, next) => {
  logger.error('Application Error', {
    method: req.method,
    url: req.originalUrl,
    error: err.message,
    stack: err.stack,
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection.remoteAddress,
    userId: req.user?.id
  });
  
  next(err);
};

const performanceLogger = (threshold = 1000) => {
  return (req, res, next) => {
    const startTime = process.hrtime.bigint();
    
    res.on('finish', () => {
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000;
      
      if (duration > threshold) {
        logger.warn('Slow Request', {
          method: req.method,
          url: req.originalUrl,
          duration: `${duration.toFixed(2)}ms`,
          threshold: `${threshold}ms`
        });
      }
    });
    
    next();
  };
};

const securityLogger = {
  authFailure: (req, reason, details = {}) => {
    logger.warn('Authentication Failure', {
      method: req.method,
      url: req.originalUrl,
      reason,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      ...details
    });
  },
  
  rateLimitExceeded: (req, details = {}) => {
    logger.warn('Rate Limit Exceeded', {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      ...details
    });
  },
  
  suspiciousActivity: (req, activity, details = {}) => {
    logger.warn('Suspicious Activity', {
      method: req.method,
      url: req.originalUrl,
      activity,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id,
      ...details
    });
  },
  
  dataAccess: (userId, resource, action, details = {}) => {
    logger.info('Data Access', {
      userId,
      resource,
      action,
      ...details
    });
  }
};

const businessLogger = {
  userRegistered: (userId, userType, details = {}) => {
    logger.info('User Registered', {
      userId,
      userType,
      ...details
    });
  },
  
  orderCreated: (orderId, userId, merchantId, amount, details = {}) => {
    logger.info('Order Created', {
      orderId,
      userId,
      merchantId,
      amount,
      ...details
    });
  },
  
  paymentProcessed: (paymentId, orderId, amount, method, status, details = {}) => {
    logger.info('Payment Processed', {
      paymentId,
      orderId,
      amount,
      method,
      status,
      ...details
    });
  },
  
  merchantRegistered: (merchantId, userId, category, details = {}) => {
    logger.info('Merchant Registered', {
      merchantId,
      userId,
      category,
      ...details
    });
  }
};

module.exports = {
  logger,
  requestLogger,
  errorLogger,
  performanceLogger,
  securityLogger,
  businessLogger
};