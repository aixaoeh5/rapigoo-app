#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Comprehensive E2E Test Runner for Rapigoo Application
 * 
 * This runner executes all end-to-end tests and generates detailed reports
 * to validate that the system fixes work correctly from a user perspective.
 */

class E2ETestRunner {
  constructor() {
    this.testSuites = [
      {
        name: 'Customer Journey Tests',
        file: 'customerJourney.test.js',
        description: 'Complete customer user flow from registration to order completion',
        priority: 'critical'
      },
      {
        name: 'Merchant Workflow Tests',
        file: 'merchantWorkflow.test.js',
        description: 'Merchant business operations and order management',
        priority: 'critical'
      },
      {
        name: 'Delivery Person Flow Tests',
        file: 'deliveryPersonFlow.test.js',
        description: 'Delivery assignment, tracking, and completion workflows',
        priority: 'critical'
      },
      {
        name: 'Cross-User Integration Tests',
        file: 'crossUserIntegration.test.js',
        description: 'Multi-user interactions and real-time communication',
        priority: 'high'
      },
      {
        name: 'Data Integrity Tests',
        file: 'dataIntegrityTests.test.js',
        description: 'Transaction atomicity and data consistency validation',
        priority: 'critical'
      },
      {
        name: 'API Integration Tests',
        file: 'apiIntegrationTests.test.js',
        description: 'Backend API and external service integration',
        priority: 'high'
      },
      {
        name: 'Stress and Edge Cases',
        file: 'stressAndEdgeCases.test.js',
        description: 'High-load scenarios and error condition handling',
        priority: 'medium'
      }
    ];

    this.results = [];
    this.startTime = Date.now();
  }

  async runAllTests() {
    console.log('\n🚀 Starting Rapigoo E2E Test Suite');
    console.log('=====================================\n');

    console.log('📋 Test Plan:');
    this.testSuites.forEach((suite, index) => {
      console.log(`  ${index + 1}. ${suite.name} [${suite.priority}]`);
      console.log(`     ${suite.description}`);
    });
    console.log('\n');

    // Run each test suite
    for (const suite of this.testSuites) {
      await this.runTestSuite(suite);
    }

    // Generate final report
    this.generateFinalReport();
  }

  async runTestSuite(suite) {
    console.log(`\n🧪 Running: ${suite.name}`);
    console.log(`📁 File: ${suite.file}`);
    console.log(`⚡ Priority: ${suite.priority}`);
    console.log('─'.repeat(50));

    const startTime = Date.now();
    
    try {
      const result = await this.executeJestTest(suite.file);
      const endTime = Date.now();
      const duration = endTime - startTime;

      const suiteResult = {
        name: suite.name,
        file: suite.file,
        priority: suite.priority,
        duration,
        success: result.success,
        stats: result.stats,
        output: result.output,
        errors: result.errors
      };

      this.results.push(suiteResult);

      if (result.success) {
        console.log(`✅ ${suite.name} - PASSED (${duration}ms)`);
        console.log(`   Tests: ${result.stats.passed}/${result.stats.total} passed`);
      } else {
        console.log(`❌ ${suite.name} - FAILED (${duration}ms)`);
        console.log(`   Tests: ${result.stats.passed}/${result.stats.total} passed`);
        console.log(`   Failures: ${result.stats.failed}`);
        if (result.errors.length > 0) {
          console.log('   Errors:');
          result.errors.slice(0, 3).forEach(error => {
            console.log(`     • ${error}`);
          });
        }
      }
    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;

      const suiteResult = {
        name: suite.name,
        file: suite.file,
        priority: suite.priority,
        duration,
        success: false,
        stats: { total: 0, passed: 0, failed: 1 },
        output: '',
        errors: [error.message]
      };

      this.results.push(suiteResult);
      console.log(`💥 ${suite.name} - CRASHED (${duration}ms)`);
      console.log(`   Error: ${error.message}`);
    }
  }

  executeJestTest(testFile) {
    return new Promise((resolve) => {
      const testPath = path.join(__dirname, testFile);
      
      // Determine the correct command based on platform
      let command, args;
      if (process.platform === 'win32') {
        // Windows - try different approaches
        command = 'cmd';
        args = ['/c', 'npx', 'jest', testPath, '--verbose', '--json'];
      } else {
        // Unix-like systems
        command = 'npx';
        args = ['jest', testPath, '--verbose', '--json'];
      }
      
      const jestProcess = spawn(command, args, {
        stdio: ['inherit', 'pipe', 'pipe'],
        cwd: path.dirname(__dirname),
        shell: true
      });

      let stdout = '';
      let stderr = '';

      jestProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      jestProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      jestProcess.on('close', (code) => {
        try {
          // Parse Jest JSON output
          const jsonOutput = this.extractJsonFromOutput(stdout);
          const stats = this.parseJestStats(jsonOutput);
          const errors = this.parseJestErrors(jsonOutput);

          resolve({
            success: code === 0,
            stats,
            output: stdout,
            errors
          });
        } catch (error) {
          resolve({
            success: false,
            stats: { total: 0, passed: 0, failed: 1 },
            output: stdout,
            errors: [stderr || error.message]
          });
        }
      });
    });
  }

  extractJsonFromOutput(output) {
    // Extract JSON from Jest output
    const lines = output.split('\n');
    const jsonLine = lines.find(line => line.trim().startsWith('{') && line.includes('"success"'));
    
    if (jsonLine) {
      return JSON.parse(jsonLine);
    }
    
    return null;
  }

  parseJestStats(jsonOutput) {
    if (!jsonOutput) {
      return { total: 0, passed: 0, failed: 0 };
    }

    const { testResults } = jsonOutput;
    let total = 0;
    let passed = 0;
    let failed = 0;

    if (testResults && testResults.length > 0) {
      testResults.forEach(file => {
        total += file.numPassingTests + file.numFailingTests;
        passed += file.numPassingTests;
        failed += file.numFailingTests;
      });
    }

    return { total, passed, failed };
  }

  parseJestErrors(jsonOutput) {
    if (!jsonOutput || !jsonOutput.testResults) {
      return [];
    }

    const errors = [];
    jsonOutput.testResults.forEach(file => {
      file.assertionResults.forEach(test => {
        if (test.status === 'failed') {
          test.failureMessages.forEach(message => {
            // Extract meaningful error message
            const cleanMessage = message
              .replace(/\u001b\[[0-9;]*m/g, '') // Remove ANSI colors
              .split('\n')[0] // Take first line
              .slice(0, 100); // Limit length
            errors.push(cleanMessage);
          });
        }
      });
    });

    return errors;
  }

  generateFinalReport() {
    const endTime = Date.now();
    const totalDuration = endTime - this.startTime;

    console.log('\n\n📊 FINAL TEST REPORT');
    console.log('='.repeat(60));

    // Summary statistics
    const totalTests = this.results.reduce((sum, r) => sum + r.stats.total, 0);
    const passedTests = this.results.reduce((sum, r) => sum + r.stats.passed, 0);
    const failedTests = this.results.reduce((sum, r) => sum + r.stats.failed, 0);
    const successfulSuites = this.results.filter(r => r.success).length;
    const failedSuites = this.results.filter(r => !r.success).length;

    console.log('\n📈 SUMMARY:');
    console.log(`   Total Test Suites: ${this.results.length}`);
    console.log(`   Successful Suites: ${successfulSuites}`);
    console.log(`   Failed Suites: ${failedSuites}`);
    console.log(`   Total Tests: ${totalTests}`);
    console.log(`   Passed Tests: ${passedTests}`);
    console.log(`   Failed Tests: ${failedTests}`);
    console.log(`   Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
    console.log(`   Total Duration: ${(totalDuration / 1000).toFixed(2)}s`);

    // Suite breakdown
    console.log('\n📋 SUITE BREAKDOWN:');
    this.results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      const duration = `${(result.duration / 1000).toFixed(2)}s`;
      console.log(`   ${status} ${result.name.padEnd(30)} ${duration.padStart(8)} [${result.priority}]`);
      console.log(`      ${result.stats.passed}/${result.stats.total} tests passed`);
    });

    // Critical failures
    const criticalFailures = this.results.filter(r => !r.success && r.priority === 'critical');
    if (criticalFailures.length > 0) {
      console.log('\n🚨 CRITICAL FAILURES:');
      criticalFailures.forEach(failure => {
        console.log(`   ❌ ${failure.name}`);
        if (failure.errors.length > 0) {
          failure.errors.slice(0, 2).forEach(error => {
            console.log(`      • ${error}`);
          });
        }
      });
    }

    // Performance metrics
    console.log('\n⚡ PERFORMANCE:');
    const avgSuiteDuration = this.results.reduce((sum, r) => sum + r.duration, 0) / this.results.length;
    const slowestSuite = this.results.reduce((prev, current) => 
      prev.duration > current.duration ? prev : current
    );
    console.log(`   Average Suite Duration: ${(avgSuiteDuration / 1000).toFixed(2)}s`);
    console.log(`   Slowest Suite: ${slowestSuite.name} (${(slowestSuite.duration / 1000).toFixed(2)}s)`);

    // Quality assessment
    console.log('\n🎯 QUALITY ASSESSMENT:');
    const successRate = (passedTests / totalTests) * 100;
    const criticalSuccessRate = successfulSuites / this.results.filter(r => r.priority === 'critical').length * 100;
    
    if (successRate >= 95 && criticalFailures.length === 0) {
      console.log('   🟢 EXCELLENT - System is production ready');
    } else if (successRate >= 85 && criticalFailures.length <= 1) {
      console.log('   🟡 GOOD - Minor issues need attention');
    } else if (successRate >= 70 && criticalFailures.length <= 2) {
      console.log('   🟠 FAIR - Several issues need resolution');
    } else {
      console.log('   🔴 POOR - System needs significant work');
    }

    // Recommendations
    console.log('\n💡 RECOMMENDATIONS:');
    if (criticalFailures.length > 0) {
      console.log('   • Fix all critical test failures before deployment');
    }
    if (successRate < 90) {
      console.log('   • Investigate and resolve failing tests');
    }
    if (avgSuiteDuration > 30000) {
      console.log('   • Optimize test performance (currently slow)');
    }
    if (successRate >= 95 && criticalFailures.length === 0) {
      console.log('   • System is ready for production deployment! 🚀');
    }

    // Save detailed report
    this.saveDetailedReport();

    console.log('\n📁 Detailed report saved to: test-report.json');
    console.log('='.repeat(60));
  }

  saveDetailedReport() {
    const report = {
      timestamp: new Date().toISOString(),
      duration: Date.now() - this.startTime,
      summary: {
        totalSuites: this.results.length,
        successfulSuites: this.results.filter(r => r.success).length,
        failedSuites: this.results.filter(r => !r.success).length,
        totalTests: this.results.reduce((sum, r) => sum + r.stats.total, 0),
        passedTests: this.results.reduce((sum, r) => sum + r.stats.passed, 0),
        failedTests: this.results.reduce((sum, r) => sum + r.stats.failed, 0)
      },
      suites: this.results,
      criticalFailures: this.results.filter(r => !r.success && r.priority === 'critical'),
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
      }
    };

    fs.writeFileSync(
      path.join(__dirname, '../test-report.json'),
      JSON.stringify(report, null, 2)
    );
  }
}

// Run the tests if this file is executed directly
if (require.main === module) {
  const runner = new E2ETestRunner();
  
  runner.runAllTests()
    .then(() => {
      const successRate = runner.results.reduce((sum, r) => sum + r.stats.passed, 0) / 
                         runner.results.reduce((sum, r) => sum + r.stats.total, 0) * 100;
      const criticalFailures = runner.results.filter(r => !r.success && r.priority === 'critical').length;
      
      // Exit with appropriate code
      if (successRate >= 95 && criticalFailures === 0) {
        process.exit(0); // Success
      } else if (criticalFailures > 0) {
        process.exit(2); // Critical failures
      } else {
        process.exit(1); // Some failures
      }
    })
    .catch((error) => {
      console.error('Test runner crashed:', error);
      process.exit(3);
    });
}

module.exports = E2ETestRunner;