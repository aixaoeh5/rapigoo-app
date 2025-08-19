/**
 * Middleware to validate delivery data integrity before sending responses
 */

const validateDeliveryData = (req, res, next) => {
  // Store original json method
  const originalJson = res.json;
  
  // Override res.json to validate delivery data
  res.json = function(data) {
    if (data && data.success && data.data) {
      // Validate deliveries array
      if (data.data.deliveries && Array.isArray(data.data.deliveries)) {
        data.data.deliveries = data.data.deliveries.filter(delivery => {
          if (!delivery) return false;
          
          if (!delivery.orderId) {
            console.error(`❌ Middleware: Filtering delivery ${delivery._id} with null orderId`);
            return false;
          }
          
          // Check if orderId is populated and has required fields
          if (typeof delivery.orderId === 'object' && delivery.orderId !== null) {
            if (!delivery.orderId.orderNumber) {
              console.warn(`⚠️ Middleware: Delivery ${delivery._id} has orderId without orderNumber`);
            }
          }
          
          return true;
        });
      }
      
      // Validate single delivery tracking
      if (data.data.deliveryTracking) {
        const tracking = data.data.deliveryTracking;
        if (!tracking.orderId) {
          console.error(`❌ Middleware: Delivery tracking ${tracking._id} has null orderId`);
          return originalJson.call(this, {
            success: false,
            error: {
              message: 'Delivery data integrity error',
              code: 'INVALID_DELIVERY_DATA'
            }
          });
        }
      }
      
      // Validate active deliveries
      if (data.data.activeDeliveries && Array.isArray(data.data.activeDeliveries)) {
        data.data.activeDeliveries = data.data.activeDeliveries.filter(delivery => {
          if (!delivery || !delivery.orderId) {
            console.error(`❌ Middleware: Filtering active delivery with invalid data`);
            return false;
          }
          return true;
        });
      }
    }
    
    return originalJson.call(this, data);
  };
  
  next();
};

const validateDeliveryIntegrity = async (deliveries) => {
  if (!Array.isArray(deliveries)) return deliveries;
  
  const validDeliveries = [];
  const invalidCount = { nullOrderId: 0, missingOrderNumber: 0 };
  
  for (const delivery of deliveries) {
    if (!delivery) continue;
    
    // Check for null orderId
    if (!delivery.orderId) {
      invalidCount.nullOrderId++;
      console.error(`❌ Invalid delivery data: ${delivery._id} has null orderId`);
      continue;
    }
    
    // Check populated orderId structure
    if (typeof delivery.orderId === 'object' && delivery.orderId !== null) {
      if (!delivery.orderId.orderNumber) {
        invalidCount.missingOrderNumber++;
        console.warn(`⚠️ Warning: Delivery ${delivery._id} orderId missing orderNumber`);
      }
    }
    
    validDeliveries.push(delivery);
  }
  
  if (invalidCount.nullOrderId > 0 || invalidCount.missingOrderNumber > 0) {
    console.log(`📊 Data validation summary:`, {
      total: deliveries.length,
      valid: validDeliveries.length,
      nullOrderId: invalidCount.nullOrderId,
      missingOrderNumber: invalidCount.missingOrderNumber
    });
  }
  
  return validDeliveries;
};

module.exports = {
  validateDeliveryData,
  validateDeliveryIntegrity
};