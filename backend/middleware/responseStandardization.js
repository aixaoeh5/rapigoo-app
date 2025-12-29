const { v4: uuidv4 } = require('uuid');

/**
 * Middleware for standardizing API responses across the application
 */

// Request ID middleware for tracking
const requestId = (req, res, next) => {
  req.requestId = req.headers['x-request-id'] || uuidv4();
  res.setHeader('X-Request-ID', req.requestId);
  next();
};

// Response standardization middleware
const standardizeResponse = (req, res, next) => {
  // Store original json method
  const originalJson = res.json;
  
  // Override res.json to standardize responses
  res.json = function(data) {
    const timestamp = new Date().toISOString();
    const requestId = req.requestId;
    
    let standardResponse;
    
    // If data already has success field, assume it's already formatted
    if (data && typeof data === 'object' && 'success' in data) {
      standardResponse = {
        ...data,
        meta: {
          timestamp,
          requestId,
          ...data.meta
        }
      };
    } else {
      // Standardize based on response status
      const isSuccess = res.statusCode >= 200 && res.statusCode < 300;
      
      if (isSuccess) {
        standardResponse = {
          success: true,
          data: data,
          meta: {
            timestamp,
            requestId
          }
        };
      } else {
        // Error response
        standardResponse = {
          success: false,
          error: {
            message: data?.message || data?.error || 'Unknown error',
            code: data?.code || 'UNKNOWN_ERROR',
            details: data?.details || null
          },
          meta: {
            timestamp,
            requestId
          }
        };
      }
    }
    
    return originalJson.call(this, standardResponse);
  };
  
  // Add helper methods
  res.success = function(data, message = null) {
    return this.json({
      success: true,
      data,
      message,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      }
    });
  };
  
  res.error = function(message, code = 'ERROR', statusCode = 500, details = null) {
    this.status(statusCode);
    return this.json({
      success: false,
      error: {
        message,
        code,
        details
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      }
    });
  };
  
  res.validationError = function(errors, message = 'Validation failed') {
    this.status(400);
    return this.json({
      success: false,
      error: {
        message,
        code: 'VALIDATION_ERROR',
        details: errors
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      }
    });
  };
  
  res.notFound = function(message = 'Resource not found') {
    this.status(404);
    return this.json({
      success: false,
      error: {
        message,
        code: 'NOT_FOUND'
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      }
    });
  };
  
  res.unauthorized = function(message = 'Unauthorized access') {
    this.status(401);
    return this.json({
      success: false,
      error: {
        message,
        code: 'UNAUTHORIZED'
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      }
    });
  };
  
  res.forbidden = function(message = 'Access forbidden') {
    this.status(403);
    return this.json({
      success: false,
      error: {
        message,
        code: 'FORBIDDEN'
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      }
    });
  };
  
  res.conflict = function(message = 'Resource conflict', details = null) {
    this.status(409);
    return this.json({
      success: false,
      error: {
        message,
        code: 'CONFLICT',
        details
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      }
    });
  };
  
  res.paginated = function(data, pagination) {
    return this.json({
      success: true,
      data,
      pagination: {
        page: parseInt(pagination.page) || 1,
        limit: parseInt(pagination.limit) || 20,
        total: pagination.total || 0,
        pages: pagination.pages || Math.ceil((pagination.total || 0) / (pagination.limit || 20)),
        hasNext: pagination.hasNext || false,
        hasPrev: pagination.hasPrev || false
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      }
    });
  };
  
  next();
};

// Global error handler middleware
const globalErrorHandler = (err, req, res, next) => {
  console.error('Global error handler:', {
    requestId: req.requestId,
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method
  });
  
  // Handle specific error types
  if (err.name === 'ValidationError') {
    return res.validationError(
      Object.values(err.errors).map(e => e.message),
      'Validation failed'
    );
  }
  
  if (err.name === 'CastError') {
    return res.error('Invalid ID format', 'INVALID_ID', 400);
  }
  
  if (err.name === 'MongoServerError' && err.code === 11000) {
    return res.error('Duplicate entry', 'DUPLICATE_ENTRY', 409);
  }
  
  if (err.name === 'JsonWebTokenError') {
    return res.unauthorized('Invalid token');
  }
  
  if (err.name === 'TokenExpiredError') {
    return res.unauthorized('Token expired');
  }
  
  if (err.name === 'ConcurrencyConflictError') {
    return res.conflict(err.message, { currentVersion: err.currentVersion });
  }
  
  // Default error response
  const isDevelopment = process.env.NODE_ENV === 'development';
  res.error(
    isDevelopment ? err.message : 'Internal server error',
    'INTERNAL_SERVER_ERROR',
    500,
    isDevelopment ? { stack: err.stack } : null
  );
};

module.exports = {
  requestId,
  standardizeResponse,
  globalErrorHandler
};