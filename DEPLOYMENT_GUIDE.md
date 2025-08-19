# RAPIGOO CRITICAL FIXES DEPLOYMENT GUIDE

## Pre-deployment Checklist

### ✅ Critical Requirements
- [ ] Database backup completed
- [ ] All tests passing (`npm test`)
- [ ] Development environment tested
- [ ] Migration scripts tested
- [ ] Rollback plan documented
- [ ] Monitoring alerts configured

### ✅ Dependencies Verified
- [ ] MongoDB replica set configured (for transactions)
- [ ] Node.js version compatible (>=14.x)
- [ ] UUID package installed (`npm install uuid`)
- [ ] All environment variables set

## Deployment Sequence

### Phase 1: Database Migrations (5 minutes)
```bash
# 1. Backup database
mongodump --db rapigoo --out ./backup/$(date +%Y%m%d_%H%M%S)

# 2. Run version migration
cd backend
node scripts/migrateOrderVersioning.js

# 3. Verify migration
node scripts/checkOrphanedDeliveryRecords.js
```

### Phase 2: Backend Deployment (10 minutes)
```bash
# 1. Install dependencies
npm install uuid

# 2. Deploy updated models and controllers
# Files to deploy:
# - backend/models/Order.js (optimistic locking)
# - backend/models/Cart.js (transaction support)
# - backend/models/DeliveryTracking.js (status constants)
# - backend/controllers/orderController.js (transactions)
# - backend/routes/deliveryRoutes.js (atomic assignment)
# - backend/routes/orderRoutes.js (concurrency handling)

# 3. Deploy new utilities and middleware
# - backend/utils/statusConstants.js
# - backend/utils/transactionHelper.js
# - backend/middleware/responseStandardization.js
# - backend/middleware/deliveryDataValidation.js

# 4. Restart backend services
pm2 restart rapigoo-backend
```

### Phase 3: Frontend Deployment (5 minutes)
```bash
# Deploy error boundaries
# - components/shared/ErrorBoundary.js
# - components/shared/CheckoutErrorBoundary.js
# - components/shared/DeliveryErrorBoundary.js

# Update fixed components
# - components/context/CartContext.js (infinite loop fix)
# - components/HomeDeliveryScreen.js (null safety)

# Restart frontend services
expo start --clear
```

### Phase 4: Verification (10 minutes)
```bash
# 1. Run integration tests
npm run test:integration

# 2. Test critical flows manually
# - Create order (transaction test)
# - Assign delivery (atomicity test)
# - Update order status (concurrency test)

# 3. Monitor logs for errors
tail -f logs/application.log | grep ERROR

# 4. Check health endpoints
curl http://localhost:3000/api/health
```

## Rollback Procedures

### If Database Issues Occur:
```bash
# 1. Stop application
pm2 stop rapigoo-backend

# 2. Restore database backup
mongorestore --db rapigoo --drop ./backup/[timestamp]

# 3. Revert to previous code version
git checkout [previous-commit]
pm2 start rapigoo-backend
```

### If Application Errors Occur:
```bash
# 1. Check specific error type
# 2. If transaction errors: Verify MongoDB replica set
# 3. If version conflicts: Clear problematic records
# 4. If infinite loops: Restart with previous CartContext

# Quick fixes for common issues:
# Transaction not supported: Set MONGO_URI to replica set
# Version conflicts: Run: node scripts/resetOrderVersions.js
# Infinite loops: Clear AsyncStorage and restart app
```

## Monitoring Setup

### Key Metrics to Watch
```javascript
// Add to monitoring dashboard
{
  "order_creation_success_rate": ">=98%",
  "transaction_failure_rate": "<=2%", 
  "concurrency_conflicts": "<=5/hour",
  "api_response_time_p95": "<=2000ms",
  "error_boundary_triggers": "<=10/hour"
}
```

### Log Alerts
```bash
# Set up alerts for:
grep "Concurrent modification detected" logs/app.log
grep "TransientTransactionError" logs/app.log  
grep "ORDER_ALREADY_ASSIGNED" logs/app.log
grep "Maximum update depth exceeded" logs/app.log
```

## Success Criteria

### Must Pass (Go/No-Go)
- [ ] Order creation completes successfully
- [ ] No infinite re-render errors in logs
- [ ] Delivery assignment works without double-assignment
- [ ] Status updates handle concurrency correctly
- [ ] Error boundaries catch and display properly

### Performance Targets
- [ ] Order creation: <3 seconds
- [ ] Status updates: <1 second
- [ ] API response time: <2 seconds (95th percentile)
- [ ] Memory usage: Stable (no leaks)

## Post-Deployment Validation

### Day 1 Checklist
- [ ] Monitor error rates for 24 hours
- [ ] Verify transaction success rates
- [ ] Check for any new error patterns
- [ ] Validate user feedback

### Week 1 Checklist  
- [ ] Review performance metrics
- [ ] Analyze error logs
- [ ] User experience feedback
- [ ] System stability assessment

## Emergency Contacts

### Development Team
- **Backend Lead**: [Contact Info]
- **Frontend Lead**: [Contact Info]
- **DevOps**: [Contact Info]

### Escalation Process
1. **Level 1**: Development team member
2. **Level 2**: Technical lead
3. **Level 3**: System architect
4. **Level 4**: CTO/Engineering director

## Additional Notes

### Known Limitations
- Transactions require MongoDB replica set
- Optimistic locking may increase conflict rates initially
- Error boundaries only catch render errors, not async errors

### Future Improvements
- Add distributed locking for high-concurrency scenarios
- Implement request deduplication
- Add automated rollback triggers
- Enhanced monitoring dashboards

---

**Deployment Approval Required From:**
- [ ] Technical Lead
- [ ] QA Lead  
- [ ] Product Owner
- [ ] DevOps Lead

**Deployment Date**: ___________
**Deployed By**: ___________
**Rollback Window**: 4 hours post-deployment