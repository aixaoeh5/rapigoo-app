@echo off
echo.
echo 🚀 Rapigoo E2E Test Suite Runner for Windows
echo ============================================
echo.

REM Check if Node.js is available
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo ✅ Node.js found: 
node --version

REM Check if npm is available  
npm --version >nul 2>&1
if errorlevel 1 (
    echo ❌ npm is not available
    pause
    exit /b 1
)

echo ✅ npm found:
npm --version

echo.
echo 📦 Installing dependencies...
call npm install
if errorlevel 1 (
    echo ❌ Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo 🧪 Running E2E Test Framework Validator...
echo.
node __tests__/e2e/simpleTestRunner.js

if errorlevel 1 (
    echo.
    echo ⚠️  Framework validation completed with issues.
    echo See the output above for details.
) else (
    echo.
    echo ✅ Framework validation successful!
    echo.
    echo 🚀 You can now run the actual tests using:
    echo    npm run test:e2e
    echo.
    echo Or run individual test suites:
    echo    npx jest __tests__/e2e/customerJourney.test.js --verbose
    echo    npx jest __tests__/e2e/merchantWorkflow.test.js --verbose
    echo    npx jest __tests__/e2e/deliveryPersonFlow.test.js --verbose
)

echo.
echo Press any key to exit...
pause >nul