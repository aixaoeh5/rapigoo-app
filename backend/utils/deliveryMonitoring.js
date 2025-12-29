/**
 * Delivery Monitoring and Performance Tracking
 * Tracks ParallelSaveError resolution and system performance
 */

const { logger } = require('./logger');

class DeliveryMonitoring {
  constructor() {
    this.metrics = {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      parallelSaveErrors: 0,
      versionConflicts: 0,
      timeouts: 0,
      retryAttempts: 0,
      averageResponseTime: 0,
      operationTypes: {
        location_update: { success: 0, failure: 0, total_time: 0 },
        status_update: { success: 0, failure: 0, total_time: 0 },
        delivery_completion: { success: 0, failure: 0, total_time: 0 }
      }
    };
    
    this.performanceThresholds = {
      maxResponseTime: 5000, // 5 seconds
      maxRetryAttempts: 3,
      errorRateThreshold: 0.05 // 5%
    };
    
    this.alertCallbacks = [];
    this.startTime = Date.now();
    
    // Performance tracking windows
    this.performanceWindows = {
      lastMinute: { operations: [], errors: [] },
      lastHour: { operations: [], errors: [] },
      lastDay: { operations: [], errors: [] }
    };
    
    // Cleanup old data every 5 minutes
    setInterval(() => this.cleanupOldData(), 5 * 60 * 1000);
  }

  /**
   * Track delivery operation
   */
  trackOperation(operationType, operationId, startTime, endTime, success, error = null) {
    const duration = endTime - startTime;
    const now = Date.now();
    
    // Update counters
    this.metrics.totalOperations++;
    
    if (success) {
      this.metrics.successfulOperations++;
      this.metrics.operationTypes[operationType].success++;
    } else {
      this.metrics.failedOperations++;
      this.metrics.operationTypes[operationType].failure++;
      
      // Classify error type
      this.classifyError(error);
    }
    
    // Update timing metrics
    this.metrics.operationTypes[operationType].total_time += duration;
    this.updateAverageResponseTime(duration);
    
    // Add to performance windows
    const operationData = {
      type: operationType,
      operationId,
      duration,
      success,
      error: error?.message,
      timestamp: now
    };
    
    this.addToPerformanceWindows(operationData);
    
    // Check for performance issues
    this.checkPerformanceThresholds(operationType, duration, success, error);
    
    logger.info('Operation tracked:', {
      type: operationType,
      operationId,
      duration: `${duration}ms`,
      success,
      error: error?.message
    });
  }

  /**
   * Classify and count error types
   */
  classifyError(error) {
    if (!error) return;
    
    const message = error.message?.toLowerCase() || '';
    
    if (message.includes('parallelsaveerror') || message.includes('parallel save')) {
      this.metrics.parallelSaveErrors++;
      this.triggerAlert('parallel_save_error', error);
    } else if (message.includes('version') || message.includes('conflict')) {
      this.metrics.versionConflicts++;
    } else if (message.includes('timeout')) {
      this.metrics.timeouts++;
    }
  }

  /**
   * Track retry attempt
   */
  trackRetry(operationType, operationId, attemptNumber, error) {
    this.metrics.retryAttempts++;
    
    logger.warn('Retry attempt tracked:', {
      type: operationType,
      operationId,
      attempt: attemptNumber,
      error: error?.message
    });
    
    // Alert if too many retries
    if (attemptNumber > this.performanceThresholds.maxRetryAttempts) {
      this.triggerAlert('excessive_retries', {
        operationType,
        operationId,
        attempts: attemptNumber
      });
    }
  }

  /**
   * Update average response time
   */
  updateAverageResponseTime(duration) {
    const totalTime = this.metrics.averageResponseTime * (this.metrics.totalOperations - 1);
    this.metrics.averageResponseTime = (totalTime + duration) / this.metrics.totalOperations;
  }

  /**
   * Add operation to performance windows
   */
  addToPerformanceWindows(operationData) {
    const now = Date.now();
    
    // Add to all windows
    Object.keys(this.performanceWindows).forEach(window => {
      this.performanceWindows[window].operations.push(operationData);
      
      if (!operationData.success) {
        this.performanceWindows[window].errors.push(operationData);
      }
    });
  }

  /**
   * Clean up old data from performance windows
   */
  cleanupOldData() {
    const now = Date.now();
    const windowDurations = {
      lastMinute: 60 * 1000,
      lastHour: 60 * 60 * 1000,
      lastDay: 24 * 60 * 60 * 1000
    };
    
    Object.keys(this.performanceWindows).forEach(window => {
      const maxAge = windowDurations[window];
      const cutoff = now - maxAge;
      
      this.performanceWindows[window].operations = 
        this.performanceWindows[window].operations.filter(op => op.timestamp > cutoff);
      
      this.performanceWindows[window].errors = 
        this.performanceWindows[window].errors.filter(err => err.timestamp > cutoff);
    });
  }

  /**
   * Check performance thresholds and trigger alerts
   */
  checkPerformanceThresholds(operationType, duration, success, error) {
    // Check response time
    if (duration > this.performanceThresholds.maxResponseTime) {
      this.triggerAlert('slow_response', {
        operationType,
        duration,
        threshold: this.performanceThresholds.maxResponseTime
      });
    }
    
    // Check error rate for last minute
    const lastMinuteStats = this.getWindowStats('lastMinute');
    if (lastMinuteStats.errorRate > this.performanceThresholds.errorRateThreshold) {
      this.triggerAlert('high_error_rate', {
        errorRate: lastMinuteStats.errorRate,
        threshold: this.performanceThresholds.errorRateThreshold,
        window: 'lastMinute'
      });
    }
  }

  /**
   * Get statistics for a performance window
   */
  getWindowStats(window) {
    const data = this.performanceWindows[window];
    const totalOps = data.operations.length;
    const totalErrors = data.errors.length;
    
    const errorRate = totalOps > 0 ? totalErrors / totalOps : 0;
    const averageDuration = totalOps > 0 
      ? data.operations.reduce((sum, op) => sum + op.duration, 0) / totalOps 
      : 0;
    
    return {
      totalOperations: totalOps,
      totalErrors,
      errorRate,
      averageDuration,
      successRate: 1 - errorRate
    };
  }

  /**
   * Get comprehensive delivery metrics
   */
  getMetrics() {
    const uptime = Date.now() - this.startTime;
    const operationsPerSecond = this.metrics.totalOperations / (uptime / 1000);
    
    // Calculate per-operation-type averages
    const operationAverages = {};
    Object.keys(this.metrics.operationTypes).forEach(type => {
      const typeData = this.metrics.operationTypes[type];
      const totalOps = typeData.success + typeData.failure;
      
      operationAverages[type] = {
        totalOperations: totalOps,
        successRate: totalOps > 0 ? typeData.success / totalOps : 0,
        averageTime: totalOps > 0 ? typeData.total_time / totalOps : 0
      };
    });
    
    return {
      // Overall metrics
      ...this.metrics,
      uptime,
      operationsPerSecond,
      
      // Per-operation-type averages
      operationAverages,
      
      // Window-based statistics
      windowStats: {
        lastMinute: this.getWindowStats('lastMinute'),
        lastHour: this.getWindowStats('lastHour'),
        lastDay: this.getWindowStats('lastDay')
      },
      
      // Health indicators
      health: {
        parallelSaveErrorRate: this.metrics.totalOperations > 0 
          ? this.metrics.parallelSaveErrors / this.metrics.totalOperations 
          : 0,
        overallSuccessRate: this.metrics.totalOperations > 0 
          ? this.metrics.successfulOperations / this.metrics.totalOperations 
          : 0,
        averageResponseTime: this.metrics.averageResponseTime,
        isHealthy: this.isSystemHealthy()
      }
    };
  }

  /**
   * Check overall system health
   */
  isSystemHealthy() {
    const metrics = this.getMetrics();
    
    // System is unhealthy if:
    // 1. ParallelSaveError rate > 1%
    // 2. Overall error rate > 5%
    // 3. Average response time > threshold
    
    return (
      metrics.health.parallelSaveErrorRate < 0.01 &&
      (1 - metrics.health.overallSuccessRate) < this.performanceThresholds.errorRateThreshold &&
      metrics.health.averageResponseTime < this.performanceThresholds.maxResponseTime
    );
  }

  /**
   * Register alert callback
   */
  onAlert(callback) {
    this.alertCallbacks.push(callback);
  }

  /**
   * Trigger alert
   */
  triggerAlert(alertType, data) {
    const alert = {
      type: alertType,
      data,
      timestamp: new Date(),
      severity: this.getAlertSeverity(alertType)
    };
    
    logger.error('Performance alert triggered:', alert);
    
    this.alertCallbacks.forEach(callback => {
      try {
        callback(alert);
      } catch (error) {
        logger.error('Error in alert callback:', error);
      }
    });
  }

  /**
   * Get alert severity
   */
  getAlertSeverity(alertType) {
    const severityMap = {
      parallel_save_error: 'critical',
      excessive_retries: 'high',
      high_error_rate: 'medium',
      slow_response: 'low'
    };
    
    return severityMap[alertType] || 'medium';
  }

  /**
   * Reset metrics (for testing or periodic cleanup)
   */
  resetMetrics() {
    this.metrics = {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      parallelSaveErrors: 0,
      versionConflicts: 0,
      timeouts: 0,
      retryAttempts: 0,
      averageResponseTime: 0,
      operationTypes: {
        location_update: { success: 0, failure: 0, total_time: 0 },
        status_update: { success: 0, failure: 0, total_time: 0 },
        delivery_completion: { success: 0, failure: 0, total_time: 0 }
      }
    };
    
    this.performanceWindows = {
      lastMinute: { operations: [], errors: [] },
      lastHour: { operations: [], errors: [] },
      lastDay: { operations: [], errors: [] }
    };
    
    this.startTime = Date.now();
    
    logger.info('Delivery monitoring metrics reset');
  }

  /**
   * Generate performance report
   */
  generateReport() {
    const metrics = this.getMetrics();
    const uptime = Math.floor(metrics.uptime / 1000);
    
    return {
      reportTimestamp: new Date().toISOString(),
      uptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${uptime % 60}s`,
      
      summary: {
        totalOperations: metrics.totalOperations,
        successRate: `${(metrics.health.overallSuccessRate * 100).toFixed(2)}%`,
        averageResponseTime: `${metrics.averageResponseTime.toFixed(0)}ms`,
        operationsPerSecond: metrics.operationsPerSecond.toFixed(2)
      },
      
      errorAnalysis: {
        parallelSaveErrors: metrics.parallelSaveErrors,
        versionConflicts: metrics.versionConflicts,
        timeouts: metrics.timeouts,
        retryAttempts: metrics.retryAttempts,
        parallelSaveErrorRate: `${(metrics.health.parallelSaveErrorRate * 100).toFixed(4)}%`
      },
      
      operationBreakdown: metrics.operationAverages,
      
      recentPerformance: metrics.windowStats,
      
      healthStatus: {
        isHealthy: metrics.health.isHealthy,
        issues: this.identifyHealthIssues(metrics)
      }
    };
  }

  /**
   * Identify health issues
   */
  identifyHealthIssues(metrics) {
    const issues = [];
    
    if (metrics.health.parallelSaveErrorRate > 0.01) {
      issues.push(`High ParallelSaveError rate: ${(metrics.health.parallelSaveErrorRate * 100).toFixed(2)}%`);
    }
    
    if ((1 - metrics.health.overallSuccessRate) > this.performanceThresholds.errorRateThreshold) {
      issues.push(`High error rate: ${((1 - metrics.health.overallSuccessRate) * 100).toFixed(2)}%`);
    }
    
    if (metrics.health.averageResponseTime > this.performanceThresholds.maxResponseTime) {
      issues.push(`Slow response time: ${metrics.health.averageResponseTime.toFixed(0)}ms`);
    }
    
    return issues;
  }
}

// Create singleton instance
const deliveryMonitoring = new DeliveryMonitoring();

// Helper function to create a monitoring wrapper for delivery operations
function createMonitoredOperation(operationType) {
  return function(operationFn) {
    return async function(...args) {
      const operationId = args[args.length - 1] || `${operationType}_${Date.now()}`;
      const startTime = Date.now();
      
      try {
        const result = await operationFn.apply(this, args);
        const endTime = Date.now();
        
        deliveryMonitoring.trackOperation(operationType, operationId, startTime, endTime, true);
        
        return result;
      } catch (error) {
        const endTime = Date.now();
        
        deliveryMonitoring.trackOperation(operationType, operationId, startTime, endTime, false, error);
        
        throw error;
      }
    };
  };
}

module.exports = {
  deliveryMonitoring,
  createMonitoredOperation,
  
  // Monitoring decorators
  monitorLocationUpdate: createMonitoredOperation('location_update'),
  monitorStatusUpdate: createMonitoredOperation('status_update'),
  monitorDeliveryCompletion: createMonitoredOperation('delivery_completion'),
  
  // Express middleware for monitoring delivery endpoints
  deliveryEndpointMonitoring: (req, res, next) => {
    const startTime = Date.now();
    const originalSend = res.send;
    
    res.send = function(data) {
      const endTime = Date.now();
      const success = res.statusCode < 400;
      const operationType = req.route?.path?.includes('location') ? 'location_update' :
                          req.route?.path?.includes('status') ? 'status_update' :
                          req.route?.path?.includes('complete') ? 'delivery_completion' :
                          'unknown';
      
      const operationId = req.body?.operationId || `endpoint_${Date.now()}`;
      
      deliveryMonitoring.trackOperation(operationType, operationId, startTime, endTime, success, 
        success ? null : new Error(`HTTP ${res.statusCode}`));
      
      return originalSend.call(this, data);
    };
    
    next();
  }
};