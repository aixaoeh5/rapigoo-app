// Templates de email profesionales para Rapigoo

const baseStyle = `
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f8f9fa; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
    .header { background-color: #FF6B6B; padding: 20px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 24px; }
    .content { padding: 30px; }
    .order-info { background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .item { border-bottom: 1px solid #eee; padding: 10px 0; }
    .item:last-child { border-bottom: none; }
    .total { font-weight: bold; font-size: 18px; color: #FF6B6B; margin-top: 10px; }
    .status-badge { display: inline-block; padding: 6px 12px; border-radius: 20px; font-size: 14px; font-weight: bold; }
    .status-pending { background-color: #FFF3E0; color: #FF9800; }
    .status-confirmed { background-color: #E8F5E8; color: #4CAF50; }
    .status-preparing { background-color: #E3F2FD; color: #2196F3; }
    .status-ready { background-color: #FFF8E1; color: #FFC107; }
    .status-completed { background-color: #E8F5E8; color: #4CAF50; }
    .status-cancelled { background-color: #FFEBEE; color: #F44336; }
    .footer { background-color: #f8f9fa; padding: 20px; text-align: center; color: #666; }
    .button { display: inline-block; padding: 12px 24px; background-color: #FF6B6B; color: #ffffff; text-decoration: none; border-radius: 6px; margin: 10px 0; }
  </style>
`;

const getOrderConfirmationTemplate = (order, user, merchant) => {
  const itemsHtml = order.items.map(item => `
    <div class="item">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <strong>${item.serviceName}</strong>
          <div style="color: #666; font-size: 14px;">${item.serviceDescription || ''}</div>
        </div>
        <div style="text-align: right;">
          <div>${item.quantity}x $${item.unitPrice.toFixed(2)}</div>
          <div style="font-weight: bold;">$${item.totalPrice.toFixed(2)}</div>
        </div>
      </div>
    </div>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Confirmación de Pedido - Rapigoo</title>
      ${baseStyle}
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 ¡Pedido Confirmado!</h1>
        </div>
        
        <div class="content">
          <h2>Hola ${user.name},</h2>
          <p>Tu pedido <strong>#${order.orderNumber}</strong> ha sido confirmado y enviado al comerciante.</p>
          
          <div class="order-info">
            <h3>📋 Detalles del pedido</h3>
            <div style="margin-bottom: 15px;">
              <strong>Comerciante:</strong> ${merchant.businessName}<br>
              <strong>Fecha:</strong> ${new Date(order.createdAt).toLocaleDateString('es', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}<br>
              <strong>Estado:</strong> <span class="status-badge status-pending">Pendiente</span>
            </div>
            
            <h4>Productos:</h4>
            ${itemsHtml}
            
            <div style="border-top: 2px solid #FF6B6B; margin-top: 15px; padding-top: 10px;">
              <div style="display: flex; justify-content: space-between;">
                <span>Subtotal:</span>
                <span>$${order.subtotal.toFixed(2)}</span>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span>Delivery:</span>
                <span>${order.deliveryFee === 0 ? 'Gratis' : '$' + order.deliveryFee.toFixed(2)}</span>
              </div>
              <div class="total" style="display: flex; justify-content: space-between;">
                <span>Total:</span>
                <span>$${order.total.toFixed(2)}</span>
              </div>
            </div>
          </div>
          
          <div class="order-info">
            <h3>🚚 Información de entrega</h3>
            <p><strong>Dirección:</strong> ${order.deliveryInfo.address}</p>
            ${order.deliveryInfo.instructions ? `<p><strong>Instrucciones:</strong> ${order.deliveryInfo.instructions}</p>` : ''}
            <p><strong>Teléfono:</strong> ${order.customerInfo.phone}</p>
            <p><strong>Método de pago:</strong> ${order.paymentMethod === 'cash' ? '💵 Efectivo' : '🏦 Transferencia bancaria'}</p>
          </div>
          
          <div style="background-color: #E3F2FD; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h4 style="margin-top: 0; color: #2196F3;">⏰ ¿Qué sigue?</h4>
            <ol style="margin: 0; padding-left: 20px;">
              <li>El comerciante confirmará tu pedido (≈ 5 min)</li>
              <li>Comenzará a preparar tu pedido (≈ ${order.preparationTime} min)</li>
              <li>Te notificaremos cuando esté listo</li>
              <li>¡Disfruta tu pedido!</li>
            </ol>
          </div>
          
          <p style="text-align: center;">
            <a href="#" class="button">Ver estado del pedido</a>
          </p>
        </div>
        
        <div class="footer">
          <p>¡Gracias por usar <strong>Rapigoo</strong>!</p>
          <p style="font-size: 12px; color: #999;">
            Si tienes alguna pregunta, contáctanos respondiendo a este email.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
};

const getMerchantOrderTemplate = (order, user, merchant) => {
  const itemsHtml = order.items.map(item => `
    <div class="item">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <strong>${item.serviceName}</strong>
          <div style="color: #666; font-size: 14px;">${item.serviceDescription || ''}</div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 18px; font-weight: bold; color: #FF6B6B;">${item.quantity}x</div>
          <div>$${item.totalPrice.toFixed(2)}</div>
        </div>
      </div>
    </div>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Nuevo Pedido - Rapigoo</title>
      ${baseStyle}
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔔 Nuevo Pedido Recibido</h1>
        </div>
        
        <div class="content">
          <h2>Hola ${merchant.businessName},</h2>
          <p>Has recibido un nuevo pedido <strong>#${order.orderNumber}</strong></p>
          
          <div style="background-color: #FFF3E0; padding: 15px; border-radius: 8px; border-left: 4px solid #FF9800;">
            <h3 style="margin-top: 0; color: #F57C00;">⚡ Acción requerida</h3>
            <p style="margin-bottom: 0;"><strong>Confirma este pedido lo antes posible</strong> para que el cliente sepa que está siendo procesado.</p>
          </div>
          
          <div class="order-info">
            <h3>👤 Información del cliente</h3>
            <p><strong>Nombre:</strong> ${user.name}</p>
            <p><strong>Email:</strong> ${user.email}</p>
            <p><strong>Teléfono:</strong> ${order.customerInfo.phone}</p>
            <p><strong>Hora del pedido:</strong> ${new Date(order.createdAt).toLocaleTimeString('es', {
              hour: '2-digit',
              minute: '2-digit'
            })}</p>
          </div>
          
          <div class="order-info">
            <h3>📦 Detalles del pedido</h3>
            ${itemsHtml}
            
            <div style="border-top: 2px solid #FF6B6B; margin-top: 15px; padding-top: 10px;">
              <div class="total" style="display: flex; justify-content: space-between;">
                <span>Total a cobrar:</span>
                <span>$${order.total.toFixed(2)}</span>
              </div>
              <div style="margin-top: 5px; color: #666;">
                Método de pago: <strong>${order.paymentMethod === 'cash' ? '💵 Efectivo' : '🏦 Transferencia'}</strong>
              </div>
            </div>
          </div>
          
          <div class="order-info">
            <h3>🚚 Información de entrega</h3>
            <p><strong>Dirección:</strong> ${order.deliveryInfo.address}</p>
            ${order.deliveryInfo.instructions ? `<p><strong>Instrucciones especiales:</strong> ${order.deliveryInfo.instructions}</p>` : ''}
            <p><strong>Tiempo estimado de preparación:</strong> ${order.preparationTime} minutos</p>
          </div>
          
          <div style="background-color: #E8F5E8; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h4 style="margin-top: 0; color: #4CAF50;">✅ Próximos pasos</h4>
            <ol style="margin: 0; padding-left: 20px;">
              <li><strong>Confirma el pedido</strong> en tu panel de administración</li>
              <li><strong>Prepara los productos</strong> según las especificaciones</li>
              <li><strong>Marca como "Listo"</strong> cuando esté preparado</li>
              <li><strong>Entrega al cliente</strong> y marca como "Completado"</li>
            </ol>
          </div>
          
          <p style="text-align: center;">
            <a href="#" class="button">Ir al Panel de Administración</a>
          </p>
        </div>
        
        <div class="footer">
          <p>Panel de administración: <strong>Rapigoo Business</strong></p>
          <p style="font-size: 12px; color: #999;">
            Responde rápidamente para mantener a tus clientes satisfechos.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
};

const getStatusUpdateTemplate = (order, newStatus) => {
  const statusConfig = {
    confirmed: { 
      title: 'Confirmado', 
      message: '¡Tu pedido ha sido confirmado!', 
      icon: '✅',
      color: '#4CAF50',
      description: 'El comerciante ha confirmado tu pedido y comenzará a prepararlo pronto.'
    },
    preparing: { 
      title: 'Preparando', 
      message: '¡Tu pedido se está preparando!', 
      icon: '👨‍🍳',
      color: '#2196F3',
      description: 'El comerciante está preparando tu pedido con cuidado.'
    },
    ready: { 
      title: 'Listo', 
      message: '¡Tu pedido está listo!', 
      icon: '📦',
      color: '#FF9800',
      description: 'Tu pedido está listo y será enviado en breve.'
    },
    completed: { 
      title: 'Completado', 
      message: '¡Pedido entregado!', 
      icon: '🎉',
      color: '#4CAF50',
      description: '¡Tu pedido ha sido entregado exitosamente! ¡Disfrútalo!'
    },
    cancelled: { 
      title: 'Cancelado', 
      message: 'Pedido cancelado', 
      icon: '❌',
      color: '#F44336',
      description: 'Lamentamos informarte que tu pedido ha sido cancelado.'
    }
  };

  const config = statusConfig[newStatus];

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Actualización de Pedido - Rapigoo</title>
      ${baseStyle}
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${config.icon} ${config.message}</h1>
        </div>
        
        <div class="content">
          <h2>Hola ${order.userId?.name || order.customerInfo?.name},</h2>
          <p>${config.description}</p>
          
          <div class="order-info">
            <h3>📋 Información del pedido</h3>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
              <div>
                <strong>Pedido:</strong> #${order.orderNumber}<br>
                <strong>Comerciante:</strong> ${order.merchantName}
              </div>
              <div>
                <span class="status-badge status-${newStatus}">${config.title}</span>
              </div>
            </div>
            
            <div style="display: flex; justify-content: space-between;">
              <span>Total:</span>
              <span style="font-weight: bold;">$${order.total.toFixed(2)}</span>
            </div>
          </div>
          
          ${order.estimatedDeliveryTime && newStatus !== 'completed' && newStatus !== 'cancelled' ? `
          <div style="background-color: #E3F2FD; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h4 style="margin-top: 0; color: #2196F3;">⏰ Tiempo estimado</h4>
            <p style="margin-bottom: 0;">
              <strong>${new Date(order.estimatedDeliveryTime).toLocaleTimeString('es', {
                hour: '2-digit',
                minute: '2-digit'
              })}</strong> (aproximadamente)
            </p>
          </div>
          ` : ''}
          
          ${newStatus === 'completed' ? `
          <div style="background-color: #E8F5E8; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h4 style="margin-top: 0; color: #4CAF50;">🌟 ¡Gracias por tu pedido!</h4>
            <p style="margin-bottom: 0;">
              Esperamos que hayas disfrutado tu experiencia con Rapigoo. 
              ¡Nos encantaría saber tu opinión!
            </p>
          </div>
          ` : ''}
          
          <p style="text-align: center;">
            <a href="#" class="button">Ver detalles del pedido</a>
          </p>
        </div>
        
        <div class="footer">
          <p>¡Gracias por usar <strong>Rapigoo</strong>!</p>
          <p style="font-size: 12px; color: #999;">
            Recibiste este email porque realizaste un pedido en nuestra plataforma.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
};

module.exports = {
  getOrderConfirmationTemplate,
  getMerchantOrderTemplate,
  getStatusUpdateTemplate
};