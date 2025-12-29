const fs = require('fs');
const path = require('path');

/**
 * Monitoring and Reporting Framework for E2E Tests
 * 
 * This module provides comprehensive monitoring, reporting, and alerting
 * capabilities for the end-to-end testing framework.
 */

class TestMonitoringReports {
  constructor() {
    this.metrics = {
      performance: [],
      errors: [],
      coverage: {},
      trends: []
    };
  }

  /**
   * Generate comprehensive test execution report
   */
  generateExecutionReport(testResults) {
    const report = {
      timestamp: new Date().toISOString(),
      summary: this.generateSummary(testResults),
      performance: this.analyzePerformance(testResults),
      reliability: this.analyzeReliability(testResults),
      coverage: this.analyzeCoverage(testResults),
      trends: this.analyzeTrends(testResults),
      recommendations: this.generateRecommendations(testResults),
      alerts: this.generateAlerts(testResults)
    };

    return report;
  }

  generateSummary(testResults) {
    const totalTests = testResults.reduce((sum, suite) => sum + suite.stats.total, 0);
    const passedTests = testResults.reduce((sum, suite) => sum + suite.stats.passed, 0);
    const failedTests = testResults.reduce((sum, suite) => sum + suite.stats.failed, 0);
    const totalDuration = testResults.reduce((sum, suite) => sum + suite.duration, 0);

    return {
      totalSuites: testResults.length,
      totalTests,
      passedTests,
      failedTests,
      successRate: ((passedTests / totalTests) * 100).toFixed(2),
      totalDuration: totalDuration,
      averageDuration: (totalDuration / testResults.length).toFixed(2),
      criticalFailures: testResults.filter(r => !r.success && r.priority === 'critical').length,
      highPriorityFailures: testResults.filter(r => !r.success && r.priority === 'high').length
    };
  }

  analyzePerformance(testResults) {
    const durations = testResults.map(r => r.duration);
    const sorted = durations.sort((a, b) => a - b);
    
    return {
      mean: durations.reduce((a, b) => a + b, 0) / durations.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      min: Math.min(...durations),
      max: Math.max(...durations),
      slowestSuites: testResults
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 3)
        .map(r => ({ name: r.name, duration: r.duration })),
      performanceIssues: this.identifyPerformanceIssues(testResults)
    };
  }

  identifyPerformanceIssues(testResults) {
    const issues = [];
    const avgDuration = testResults.reduce((sum, r) => sum + r.duration, 0) / testResults.length;
    const threshold = avgDuration * 2;

    testResults.forEach(result => {
      if (result.duration > threshold) {
        issues.push({
          suite: result.name,
          issue: 'slow_execution',
          duration: result.duration,
          threshold: threshold,
          severity: result.duration > threshold * 1.5 ? 'high' : 'medium'
        });
      }
    });

    return issues;
  }

  analyzeReliability(testResults) {
    const flakeyTests = this.identifyFlakeyTests(testResults);
    const errorPatterns = this.analyzeErrorPatterns(testResults);
    
    return {
      overallReliability: this.calculateReliabilityScore(testResults),
      flakeyTests,
      errorPatterns,
      stabilityTrend: this.calculateStabilityTrend(testResults),
      criticalPathReliability: this.analyzeCriticalPathReliability(testResults)
    };
  }

  identifyFlakeyTests(testResults) {
    // This would typically analyze historical data
    // For now, identify tests with inconsistent behavior
    const flakeyTests = [];
    
    testResults.forEach(result => {
      if (result.errors && result.errors.length > 0) {
        const timeoutErrors = result.errors.filter(e => 
          e.toLowerCase().includes('timeout') || 
          e.toLowerCase().includes('network') ||
          e.toLowerCase().includes('connection')
        );
        
        if (timeoutErrors.length > 0) {
          flakeyTests.push({
            suite: result.name,
            reason: 'network_timeouts',
            errorCount: timeoutErrors.length,
            severity: 'medium'
          });
        }
      }
    });

    return flakeyTests;
  }

  analyzeErrorPatterns(testResults) {
    const errorMap = new Map();
    
    testResults.forEach(result => {
      if (result.errors) {
        result.errors.forEach(error => {
          const pattern = this.extractErrorPattern(error);
          if (errorMap.has(pattern)) {
            errorMap.set(pattern, errorMap.get(pattern) + 1);
          } else {
            errorMap.set(pattern, 1);
          }
        });
      }
    });

    return Array.from(errorMap.entries())
      .map(([pattern, count]) => ({ pattern, count }))
      .sort((a, b) => b.count - a.count);
  }

  extractErrorPattern(error) {
    // Extract meaningful error patterns
    const cleanError = error.toLowerCase()
      .replace(/\d+/g, 'N') // Replace numbers with N
      .replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/g, 'UUID') // Replace UUIDs
      .replace(/\b\w+@\w+\.\w+/g, 'EMAIL'); // Replace emails
    
    return cleanError.slice(0, 100); // Limit length
  }

  calculateReliabilityScore(testResults) {
    const totalTests = testResults.reduce((sum, r) => sum + r.stats.total, 0);
    const passedTests = testResults.reduce((sum, r) => sum + r.stats.passed, 0);
    const criticalFailures = testResults.filter(r => !r.success && r.priority === 'critical').length;
    
    let score = (passedTests / totalTests) * 100;
    
    // Penalize critical failures more heavily
    score -= (criticalFailures * 10);
    
    return Math.max(0, Math.min(100, score));
  }

  calculateStabilityTrend(testResults) {
    // This would typically compare with historical data
    // For now, analyze current run stability
    const failureRate = testResults.filter(r => !r.success).length / testResults.length;
    
    if (failureRate < 0.05) return 'stable';
    if (failureRate < 0.15) return 'declining';
    return 'unstable';
  }

  analyzeCriticalPathReliability(testResults) {
    const criticalSuites = testResults.filter(r => r.priority === 'critical');
    const criticalSuccessRate = criticalSuites.filter(r => r.success).length / criticalSuites.length * 100;
    
    return {
      successRate: criticalSuccessRate.toFixed(2),
      totalCriticalSuites: criticalSuites.length,
      passedCriticalSuites: criticalSuites.filter(r => r.success).length,
      failedCriticalSuites: criticalSuites.filter(r => !r.success).length,
      criticalFailures: criticalSuites.filter(r => !r.success).map(r => ({
        name: r.name,
        errors: r.errors.slice(0, 3)
      }))
    };
  }

  analyzeCoverage(testResults) {
    // Analyze test coverage across different user flows and features
    const userFlows = {
      customer: testResults.filter(r => r.name.toLowerCase().includes('customer')),
      merchant: testResults.filter(r => r.name.toLowerCase().includes('merchant')),
      delivery: testResults.filter(r => r.name.toLowerCase().includes('delivery')),
      integration: testResults.filter(r => r.name.toLowerCase().includes('integration')),
      api: testResults.filter(r => r.name.toLowerCase().includes('api'))
    };

    const coverage = {};
    Object.keys(userFlows).forEach(flow => {
      const suites = userFlows[flow];
      if (suites.length > 0) {
        coverage[flow] = {
          suitesCount: suites.length,
          testsCount: suites.reduce((sum, s) => sum + s.stats.total, 0),
          successRate: (suites.reduce((sum, s) => sum + s.stats.passed, 0) / 
                       suites.reduce((sum, s) => sum + s.stats.total, 0) * 100).toFixed(2)
        };
      }
    });

    return {
      userFlows: coverage,
      overallCoverage: this.calculateOverallCoverage(testResults),
      gaps: this.identifyCoverageGaps(testResults)
    };
  }

  calculateOverallCoverage(testResults) {
    // Calculate coverage based on key system components
    const components = [
      'authentication',
      'order_management',
      'delivery_tracking',
      'payment_processing',
      'real_time_updates',
      'data_integrity',
      'performance',
      'security'
    ];

    const coverage = {};
    components.forEach(component => {
      const relatedTests = testResults.filter(r => 
        r.name.toLowerCase().includes(component.replace('_', '')) ||
        r.file.toLowerCase().includes(component.replace('_', ''))
      );
      
      coverage[component] = relatedTests.length > 0 ? 'covered' : 'not_covered';
    });

    const coveredComponents = Object.values(coverage).filter(c => c === 'covered').length;
    const coveragePercentage = (coveredComponents / components.length * 100).toFixed(2);

    return {
      percentage: coveragePercentage,
      components: coverage,
      coveredCount: coveredComponents,
      totalCount: components.length
    };
  }

  identifyCoverageGaps(testResults) {
    const gaps = [];
    
    // Check for missing test scenarios
    const scenarios = [
      'concurrent_user_operations',
      'network_failure_recovery',
      'database_transaction_rollback',
      'real_time_synchronization',
      'cross_platform_compatibility',
      'mobile_specific_features'
    ];

    scenarios.forEach(scenario => {
      const hasTests = testResults.some(r => 
        r.name.toLowerCase().includes(scenario.replace('_', ' ')) ||
        r.file.toLowerCase().includes(scenario)
      );
      
      if (!hasTests) {
        gaps.push({
          scenario,
          severity: this.getScenarioSeverity(scenario),
          recommendation: this.getScenarioRecommendation(scenario)
        });
      }
    });

    return gaps;
  }

  getScenarioSeverity(scenario) {
    const highPriorityScenarios = [
      'concurrent_user_operations',
      'database_transaction_rollback',
      'real_time_synchronization'
    ];
    
    return highPriorityScenarios.includes(scenario) ? 'high' : 'medium';
  }

  getScenarioRecommendation(scenario) {
    const recommendations = {
      'concurrent_user_operations': 'Add tests for simultaneous user actions and race conditions',
      'network_failure_recovery': 'Test app behavior during network interruptions',
      'database_transaction_rollback': 'Verify data consistency during transaction failures',
      'real_time_synchronization': 'Test WebSocket connections and real-time updates',
      'cross_platform_compatibility': 'Test on different operating systems and browsers',
      'mobile_specific_features': 'Test mobile-specific functionality and responsive design'
    };
    
    return recommendations[scenario] || 'Add comprehensive tests for this scenario';
  }

  analyzeTrends(testResults) {
    // This would typically analyze historical data
    // For now, provide current run analysis
    return {
      performanceTrend: this.analyzePerformanceTrend(testResults),
      reliabilityTrend: this.calculateStabilityTrend(testResults),
      testCountTrend: 'stable', // Would compare with historical data
      recommendations: this.generateTrendRecommendations(testResults)
    };
  }

  analyzePerformanceTrend(testResults) {
    const avgDuration = testResults.reduce((sum, r) => sum + r.duration, 0) / testResults.length;
    
    // Arbitrary thresholds - would be based on historical data
    if (avgDuration > 30000) return 'degrading';
    if (avgDuration > 20000) return 'stable';
    return 'improving';
  }

  generateTrendRecommendations(testResults) {
    const recommendations = [];
    const avgDuration = testResults.reduce((sum, r) => sum + r.duration, 0) / testResults.length;
    
    if (avgDuration > 25000) {
      recommendations.push('Consider optimizing test execution time');
    }
    
    const failureRate = testResults.filter(r => !r.success).length / testResults.length;
    if (failureRate > 0.1) {
      recommendations.push('Investigate and fix failing tests to improve reliability');
    }
    
    const criticalFailures = testResults.filter(r => !r.success && r.priority === 'critical').length;
    if (criticalFailures > 0) {
      recommendations.push('Address critical test failures before deployment');
    }
    
    return recommendations;
  }

  generateRecommendations(testResults) {
    const recommendations = [];
    const summary = this.generateSummary(testResults);
    
    // Performance recommendations
    if (parseFloat(summary.averageDuration) > 25000) {
      recommendations.push({
        category: 'performance',
        priority: 'medium',
        title: 'Optimize Test Execution Time',
        description: 'Average test suite duration is high. Consider parallel execution or test optimization.',
        action: 'Review slow test suites and implement performance improvements'
      });
    }
    
    // Reliability recommendations
    if (parseFloat(summary.successRate) < 95) {
      recommendations.push({
        category: 'reliability',
        priority: 'high',
        title: 'Improve Test Success Rate',
        description: `Current success rate is ${summary.successRate}%. Target should be >95%.`,
        action: 'Investigate and fix failing tests, improve test stability'
      });
    }
    
    // Critical failure recommendations
    if (summary.criticalFailures > 0) {
      recommendations.push({
        category: 'critical',
        priority: 'urgent',
        title: 'Fix Critical Test Failures',
        description: `${summary.criticalFailures} critical test suite(s) are failing.`,
        action: 'Immediately investigate and resolve critical test failures'
      });
    }
    
    // Coverage recommendations
    const coverage = this.analyzeCoverage(testResults);
    if (parseFloat(coverage.overallCoverage.percentage) < 80) {
      recommendations.push({
        category: 'coverage',
        priority: 'medium',
        title: 'Increase Test Coverage',
        description: `Test coverage is ${coverage.overallCoverage.percentage}%. Consider adding more comprehensive tests.`,
        action: 'Add tests for uncovered components and scenarios'
      });
    }
    
    return recommendations;
  }

  generateAlerts(testResults) {
    const alerts = [];
    const summary = this.generateSummary(testResults);
    
    // Critical alerts
    if (summary.criticalFailures > 0) {
      alerts.push({
        level: 'critical',
        title: 'Critical Test Failures Detected',
        message: `${summary.criticalFailures} critical test suite(s) failed. Deployment should be blocked.`,
        timestamp: new Date().toISOString(),
        action: 'immediate_attention_required'
      });
    }
    
    // Warning alerts
    if (parseFloat(summary.successRate) < 90) {
      alerts.push({
        level: 'warning',
        title: 'Low Test Success Rate',
        message: `Test success rate is ${summary.successRate}%. This may indicate system instability.`,
        timestamp: new Date().toISOString(),
        action: 'investigation_needed'
      });
    }
    
    // Performance alerts
    if (parseFloat(summary.averageDuration) > 30000) {
      alerts.push({
        level: 'warning',
        title: 'Slow Test Execution',
        message: `Average test duration is ${(parseFloat(summary.averageDuration) / 1000).toFixed(2)}s. This may slow down development cycles.`,
        timestamp: new Date().toISOString(),
        action: 'optimization_recommended'
      });
    }
    
    return alerts;
  }

  /**
   * Generate HTML dashboard report
   */
  generateHTMLReport(testResults) {
    const report = this.generateExecutionReport(testResults);
    
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Rapigoo E2E Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric { background: #f8f9fa; padding: 15px; border-radius: 6px; text-align: center; }
        .metric h3 { margin: 0 0 10px 0; color: #333; }
        .metric .value { font-size: 24px; font-weight: bold; color: #007bff; }
        .success { color: #28a745 !important; }
        .warning { color: #ffc107 !important; }
        .danger { color: #dc3545 !important; }
        .section { margin-bottom: 30px; }
        .section h2 { border-bottom: 2px solid #007bff; padding-bottom: 10px; }
        .alert { padding: 15px; margin: 10px 0; border-radius: 6px; }
        .alert.critical { background: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; }
        .alert.warning { background: #fff3cd; border: 1px solid #ffeaa7; color: #856404; }
        .suite-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 15px; }
        .suite-card { background: #f8f9fa; padding: 15px; border-radius: 6px; border-left: 4px solid #007bff; }
        .suite-card.failed { border-left-color: #dc3545; }
        .recommendations { background: #e7f3ff; padding: 20px; border-radius: 6px; }
        .timestamp { text-align: center; color: #666; margin-top: 30px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Rapigoo E2E Test Report</h1>
            <p>Comprehensive test execution and system validation report</p>
        </div>
        
        <div class="section">
            <h2>📊 Executive Summary</h2>
            <div class="summary">
                <div class="metric">
                    <h3>Total Tests</h3>
                    <div class="value">${report.summary.totalTests}</div>
                </div>
                <div class="metric">
                    <h3>Success Rate</h3>
                    <div class="value ${parseFloat(report.summary.successRate) >= 95 ? 'success' : parseFloat(report.summary.successRate) >= 85 ? 'warning' : 'danger'}">${report.summary.successRate}%</div>
                </div>
                <div class="metric">
                    <h3>Total Duration</h3>
                    <div class="value">${(report.summary.totalDuration / 1000).toFixed(1)}s</div>
                </div>
                <div class="metric">
                    <h3>Critical Failures</h3>
                    <div class="value ${report.summary.criticalFailures === 0 ? 'success' : 'danger'}">${report.summary.criticalFailures}</div>
                </div>
            </div>
        </div>
        
        ${report.alerts.length > 0 ? `
        <div class="section">
            <h2>🚨 Alerts</h2>
            ${report.alerts.map(alert => `
                <div class="alert ${alert.level}">
                    <strong>${alert.title}</strong><br>
                    ${alert.message}
                </div>
            `).join('')}
        </div>
        ` : ''}
        
        <div class="section">
            <h2>📋 Test Suite Results</h2>
            <div class="suite-grid">
                ${testResults.map(suite => `
                    <div class="suite-card ${suite.success ? '' : 'failed'}">
                        <h4>${suite.success ? '✅' : '❌'} ${suite.name}</h4>
                        <p><strong>Priority:</strong> ${suite.priority}</p>
                        <p><strong>Tests:</strong> ${suite.stats.passed}/${suite.stats.total} passed</p>
                        <p><strong>Duration:</strong> ${(suite.duration / 1000).toFixed(2)}s</p>
                        ${suite.errors.length > 0 ? `
                            <p><strong>Errors:</strong></p>
                            <ul>${suite.errors.slice(0, 2).map(error => `<li>${error}</li>`).join('')}</ul>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
        </div>
        
        <div class="section">
            <h2>📈 Performance Analysis</h2>
            <div class="summary">
                <div class="metric">
                    <h3>Average Duration</h3>
                    <div class="value">${(report.performance.mean / 1000).toFixed(2)}s</div>
                </div>
                <div class="metric">
                    <h3>95th Percentile</h3>
                    <div class="value">${(report.performance.p95 / 1000).toFixed(2)}s</div>
                </div>
                <div class="metric">
                    <h3>Slowest Suite</h3>
                    <div class="value">${report.performance.slowestSuites[0] ? (report.performance.slowestSuites[0].duration / 1000).toFixed(2) + 's' : 'N/A'}</div>
                </div>
            </div>
        </div>
        
        ${report.recommendations.length > 0 ? `
        <div class="section">
            <h2>💡 Recommendations</h2>
            <div class="recommendations">
                ${report.recommendations.map(rec => `
                    <div style="margin-bottom: 15px;">
                        <h4>${rec.title} [${rec.priority}]</h4>
                        <p>${rec.description}</p>
                        <p><strong>Action:</strong> ${rec.action}</p>
                    </div>
                `).join('')}
            </div>
        </div>
        ` : ''}
        
        <div class="timestamp">
            Generated on ${new Date().toLocaleString()}
        </div>
    </div>
</body>
</html>`;
    
    return html;
  }

  /**
   * Save reports to files
   */
  saveReports(testResults, outputDir = '.') {
    const report = this.generateExecutionReport(testResults);
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
    
    // Save JSON report
    const jsonPath = path.join(outputDir, `test-report-${timestamp}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
    
    // Save HTML report
    const htmlPath = path.join(outputDir, `test-report-${timestamp}.html`);
    const htmlContent = this.generateHTMLReport(testResults);
    fs.writeFileSync(htmlPath, htmlContent);
    
    // Save summary report
    const summaryPath = path.join(outputDir, `test-summary-${timestamp}.txt`);
    const summaryContent = this.generateTextSummary(report);
    fs.writeFileSync(summaryContent, summaryContent);
    
    return {
      jsonPath,
      htmlPath,
      summaryPath
    };
  }

  generateTextSummary(report) {
    return `
RAPIGOO E2E TEST EXECUTION SUMMARY
==================================

Generated: ${new Date().toLocaleString()}

OVERVIEW:
- Total Tests: ${report.summary.totalTests}
- Success Rate: ${report.summary.successRate}%
- Total Duration: ${(report.summary.totalDuration / 1000).toFixed(2)}s
- Critical Failures: ${report.summary.criticalFailures}

PERFORMANCE:
- Average Duration: ${(report.performance.mean / 1000).toFixed(2)}s
- 95th Percentile: ${(report.performance.p95 / 1000).toFixed(2)}s
- Slowest Suite: ${report.performance.slowestSuites[0] ? report.performance.slowestSuites[0].name : 'N/A'}

RELIABILITY:
- Overall Score: ${report.reliability.overallReliability.toFixed(2)}%
- Stability: ${report.reliability.stabilityTrend}
- Critical Path Success: ${report.reliability.criticalPathReliability.successRate}%

ALERTS:
${report.alerts.length > 0 ? report.alerts.map(alert => `- ${alert.level.toUpperCase()}: ${alert.title}`).join('\n') : '- No alerts'}

RECOMMENDATIONS:
${report.recommendations.length > 0 ? report.recommendations.map(rec => `- [${rec.priority.toUpperCase()}] ${rec.title}: ${rec.action}`).join('\n') : '- No recommendations'}
`;
  }
}

module.exports = TestMonitoringReports;