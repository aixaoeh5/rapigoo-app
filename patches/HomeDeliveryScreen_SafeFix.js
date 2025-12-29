/**
 * PARCHE RÁPIDO para HomeDeliveryScreen
 * Aplica este código para arreglar inmediatamente los errores de null
 * 
 * INSTRUCCIONES:
 * 1. Copia las funciones de abajo
 * 2. Pégalas al principio de tu HomeDeliveryScreen.js (después de los imports)
 * 3. Reemplaza las funciones problemáticas con las versiones seguras
 */

// ========== FUNCIONES AUXILIARES SEGURAS ==========

// Función para verificar si una delivery es válida
const isValidDelivery = (delivery) => {
  return delivery && delivery._id && delivery.orderId;
};

// Función para obtener número de orden de forma segura
const safeGetOrderNumber = (delivery) => {
  try {
    if (delivery?.orderId && typeof delivery.orderId === 'object') {
      return delivery.orderId.orderNumber || 'Sin número';
    }
    if (delivery?.orderId && typeof delivery.orderId === 'string') {
      return `Pedido ${delivery.orderId.slice(-6)}`;
    }
    return 'Sin número';
  } catch (error) {
    return 'Sin número';
  }
};

// Función para obtener ID de orden de forma segura
const safeGetOrderId = (delivery) => {
  try {
    if (delivery?.orderId && typeof delivery.orderId === 'object') {
      return delivery.orderId._id || delivery.orderId.id || null;
    }
    if (delivery?.orderId && typeof delivery.orderId === 'string') {
      return delivery.orderId;
    }
    return null;
  } catch (error) {
    return null;
  }
};

// Función para filtrar deliveries válidos
const filterValidDeliveries = (deliveries) => {
  if (!Array.isArray(deliveries)) return [];
  
  const valid = deliveries.filter(delivery => {
    const isValid = isValidDelivery(delivery);
    if (!isValid) {
      console.warn('🧹 Delivery inválido filtrado:', {
        id: delivery?._id,
        orderId: delivery?.orderId,
        status: delivery?.status
      });
    }
    return isValid;
  });
  
  if (valid.length < deliveries.length) {
    console.warn(`🧹 Filtrados ${deliveries.length - valid.length} deliveries inválidos`);
  }
  
  return valid;
};

// ========== REEMPLAZAR FUNCIONES EXISTENTES ==========

// REEMPLAZA la función loadActiveDeliveries existente
const loadActiveDeliveries = async () => {
  try {
    console.log('📡 Cargando deliveries activos (versión segura)...');
    const response = await apiClient.get('/delivery/active');
    console.log('📦 Respuesta de deliveries activos:', response.data);
    
    if (response.data.success) {
      const rawDeliveries = response.data.data?.deliveries || [];
      console.log(`📥 Deliveries recibidos del servidor: ${rawDeliveries.length}`);
      
      // Filtrar deliveries válidos
      const validDeliveries = filterValidDeliveries(rawDeliveries);
      console.log(`✅ Deliveries válidos después del filtro: ${validDeliveries.length}`);
      
      setActiveDeliveries(validDeliveries);
      
      // Log de deliveries válidos
      if (validDeliveries.length > 0) {
        validDeliveries.forEach((d, i) => {
          const orderNumber = safeGetOrderNumber(d);
          console.log(`  Delivery ${i + 1}: ${orderNumber} - Status: ${d.status}`);
        });
      }
    }
  } catch (error) {
    console.error('❌ Error cargando deliveries activos:', error.message);
    // En caso de error, limpiar estado para evitar renders con datos corruptos
    setActiveDeliveries([]);
    
    if (error.response?.status === 429) {
      console.log('⏳ Rate limit, reintentando en 2 segundos...');
      setTimeout(loadActiveDeliveries, 2000);
    }
  }
};

// REEMPLAZA la función checkActiveDeliveries existente
const checkActiveDeliveries = async () => {
  try {
    console.log('🔍 Verificando entregas activas (versión segura)...');
    
    const localActiveDelivery = await ActiveDeliveryManager.getActiveDelivery();
    
    let response;
    const maxRetries = 3;
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
      try {
        response = await apiClient.get('/delivery/active');
        break;
      } catch (error) {
        if (error.response?.status === 429 && retryCount < maxRetries - 1) {
          console.log(`⏳ Rate limit, reintento ${retryCount + 1}/${maxRetries} en 2 segundos...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          retryCount++;
        } else {
          throw error;
        }
      }
    }
    
    console.log('📡 Respuesta del servidor /delivery/active:', {
      success: response?.data?.success,
      deliveriesCount: response?.data?.data?.deliveries?.length
    });
    
    if (response?.data?.success && response.data.data?.deliveries?.length > 0) {
      const rawDeliveries = response.data.data.deliveries;
      const validDeliveries = filterValidDeliveries(rawDeliveries);
      
      if (validDeliveries.length > 0) {
        const activeDelivery = validDeliveries[0];
        console.log('🚚 Primera entrega activa válida:', {
          id: activeDelivery._id,
          orderId: safeGetOrderId(activeDelivery),
          orderNumber: safeGetOrderNumber(activeDelivery),
          status: activeDelivery.status
        });
        
        const nonCompletedStates = ['assigned', 'heading_to_pickup', 'at_pickup', 'picked_up', 'heading_to_delivery', 'at_delivery'];
        
        if (nonCompletedStates.includes(activeDelivery.status)) {
          console.log('🚚 Entrega activa detectada, navegando automáticamente...');
          
          const orderIdToUse = safeGetOrderId(activeDelivery);
          
          if (orderIdToUse) {
            await ActiveDeliveryManager.setActiveDelivery({
              trackingId: activeDelivery._id,
              orderId: orderIdToUse,
              status: activeDelivery.status
            });
            
            setTimeout(() => {
              navigation.replace('DeliveryNavigation', {
                trackingId: activeDelivery._id,
                orderId: orderIdToUse
              });
            }, 100);
            
            return;
          } else {
            console.error('❌ No se pudo obtener orderId válido, limpiando entrega...');
          }
        }
      }
    }
    
    // Si llegamos aquí y hay entrega local pero no válida en servidor, limpiarla
    if (localActiveDelivery && (!response?.data?.data?.deliveries?.length || 
        filterValidDeliveries(response.data.data.deliveries).length === 0)) {
      console.log('🧹 Limpiando entrega local sin correspondencia válida en servidor...');
      await ActiveDeliveryManager.clearActiveDelivery();
    }
    
  } catch (error) {
    console.error('❌ Error verificando entregas activas:', error);
    
    // En caso de error, verificar solo storage local de forma segura
    const localActiveDelivery = await ActiveDeliveryManager.getActiveDelivery();
    if (localActiveDelivery?.trackingId) {
      console.log('📱 Verificando entrega local después de error de red...');
      
      // Solo mantener si tiene datos mínimos válidos
      if (localActiveDelivery.orderId && localActiveDelivery.trackingId) {
        setTimeout(() => {
          navigation.replace('DeliveryNavigation', {
            trackingId: localActiveDelivery.trackingId,
            orderId: localActiveDelivery.orderId
          });
        }, 100);
      } else {
        console.log('🧹 Limpiando entrega local con datos incompletos...');
        await ActiveDeliveryManager.clearActiveDelivery();
      }
    }
  }
};

// REEMPLAZA la función renderActiveDelivery existente
const renderActiveDelivery = ({ item: delivery }) => {
  // Verificación de seguridad
  if (!isValidDelivery(delivery)) {
    console.warn('⚠️ Intento de renderizar delivery inválido:', delivery);
    return null;
  }

  const orderNumber = safeGetOrderNumber(delivery);
  const orderId = safeGetOrderId(delivery);

  return (
    <TouchableOpacity
      style={styles.activeDeliveryCard}
      onPress={() => {
        if (!orderId) {
          console.error('❌ No se puede navegar: orderId inválido');
          Alert.alert(
            'Error',
            'Esta entrega tiene datos inconsistentes. Se procederá a limpiarla.',
            [
              {
                text: 'OK',
                onPress: () => {
                  // Filtrar esta entrega del estado
                  setActiveDeliveries(prev => prev.filter(d => d._id !== delivery._id));
                }
              }
            ]
          );
          return;
        }

        console.log('🚚 Navegando a DeliveryNavigation de forma segura:', {
          trackingId: delivery._id,
          orderId: orderId,
          orderNumber: orderNumber
        });

        navigation.navigate('DeliveryNavigation', {
          trackingId: delivery._id,
          orderId: orderId,
          deliveryTracking: delivery
        });
      }}
    >
      <View style={styles.activeHeader}>
        <Text style={styles.activeOrderNumber}>#{orderNumber}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(delivery.status) }]}>
          <Text style={styles.statusText}>{getStatusLabel(delivery.status)}</Text>
        </View>
      </View>

      <View style={styles.activeDetails}>
        <Text style={styles.activeDetailText}>
          Cliente: {delivery.orderId?.customerInfo?.name || 'Sin información'}
        </Text>
        <Text style={styles.activeDetailText}>
          Estado: {getStatusLabel(delivery.status)}
        </Text>
      </View>

      <View style={styles.activeActions}>
        <Text style={styles.activeActionText}>Toca para continuar →</Text>
      </View>
    </TouchableOpacity>
  );
};

// ========== CÓDIGO PARA EL BLOQUE DE DELIVERY ACTIVO ==========

// REEMPLAZA el bloque que renderiza el botón de delivery activo
const renderActiveDeliveryButton = () => {
  const validActiveDeliveries = filterValidDeliveries(activeDeliveries);
  
  if (validActiveDeliveries.length === 0) {
    return null;
  }

  const activeDelivery = validActiveDeliveries[0];
  const orderNumber = safeGetOrderNumber(activeDelivery);
  const orderId = safeGetOrderId(activeDelivery);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Delivery en Curso</Text>
      <TouchableOpacity
        style={styles.activeDeliveryButton}
        onPress={() => {
          if (!orderId) {
            Alert.alert(
              'Error',
              'Esta entrega tiene datos inconsistentes. Se procederá a limpiarla.',
              [
                {
                  text: 'OK',
                  onPress: () => setActiveDeliveries([])
                }
              ]
            );
            return;
          }

          navigation.navigate('DeliveryNavigation', {
            trackingId: activeDelivery._id,
            orderId: orderId,
            deliveryTracking: activeDelivery
          });
        }}
      >
        <View style={styles.activeDeliveryHeader}>
          <Icon name="navigation" size={24} color="#FFF" />
          <Text style={styles.activeDeliveryTitle}>Continuar Delivery</Text>
        </View>
        <Text style={styles.activeDeliverySubtitle}>
          Pedido #{orderNumber}
        </Text>
        <Text style={styles.activeDeliveryAction}>
          Toca para abrir el mapa de navegación
        </Text>
      </TouchableOpacity>
    </View>
  );
};

// ========== INSTRUCCIONES DE APLICACIÓN ==========

/*
PASOS PARA APLICAR EL PARCHE:

1. Abre tu HomeDeliveryScreen.js

2. Copia las funciones auxiliares (isValidDelivery, safeGetOrderNumber, etc.) 
   y pégalas después de los imports

3. Reemplaza estas funciones existentes:
   - loadActiveDeliveries
   - checkActiveDeliveries  
   - renderActiveDelivery

4. En el JSX donde renderizas activeDeliveries, reemplaza:
   
   ANTES:
   {activeDeliveries.length > 0 ? (
     <View style={styles.section}>
       <Text style={styles.sectionTitle}>Delivery en Curso</Text>
       <TouchableOpacity
         style={styles.activeDeliveryButton}
         onPress={() => navigation.navigate('DeliveryNavigation', {
           trackingId: activeDeliveries[0]._id,
           orderId: activeDeliveries[0].orderId?._id || activeDeliveries[0].orderId,
           deliveryTracking: activeDeliveries[0]
         })}
       >
         <View style={styles.activeDeliveryHeader}>
           <Icon name="navigation" size={24} color="#FFF" />
           <Text style={styles.activeDeliveryTitle}>Continuar Delivery</Text>
         </View>
         <Text style={styles.activeDeliverySubtitle}>
           Pedido #{activeDeliveries[0].orderId.orderNumber}
         </Text>
         <Text style={styles.activeDeliveryAction}>
           Toca para abrir el mapa de navegación
         </Text>
       </TouchableOpacity>
     </View>
   ) : (
     // ... código para órdenes disponibles
   )}

   DESPUÉS:
   {renderActiveDeliveryButton() || (
     // ... código para órdenes disponibles  
   )}

5. En el FlatList de deliveries activos, reemplaza:
   
   ANTES:
   data={activeDeliveries}
   
   DESPUÉS:
   data={filterValidDeliveries(activeDeliveries)}

6. Guarda y reinicia la app

ESTO DEBERÍA ELIMINAR TODOS LOS ERRORES DE "Cannot read property 'orderNumber' of null"
*/