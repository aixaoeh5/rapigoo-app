import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Switch,
  ActivityIndicator,
  FlatList,
  Modal,
  Linking
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../api/apiClient';
import ActiveDeliveryManager from '../utils/activeDeliveryManager';
import { interceptDeliveryHistoryNavigation } from '../test-navigation-debug';

const HomeDeliveryScreen = () => {
  const navigation = interceptDeliveryHistoryNavigation(useNavigation());
  
  // Estados principales
  const [isAvailable, setIsAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  
  // Datos
  const [availableOrders, setAvailableOrders] = useState([]);
  const [activeDeliveries, setActiveDeliveries] = useState([]);
  const [todayStats, setTodayStats] = useState({
    totalDeliveries: 0,
    completedDeliveries: 0,
    totalEarnings: 0,
    averageRating: 0
  });

  // Cargar datos al enfocar la pantalla
  useFocusEffect(
    useCallback(() => {
      loadInitialData();
    }, [])
  );

  // Auto-refresh cada 30 segundos cuando está disponible (TEMPORALMENTE DESACTIVADO)
  // useEffect(() => {
  //   let intervalId;
  //   
  //   if (isAvailable) {
  //     intervalId = setInterval(() => {
  //       console.log('🔄 Auto-refresh pedidos disponibles');
  //       loadAvailableOrders();
  //     }, 30000); // 30 segundos
  //   }

  //   return () => {
  //     if (intervalId) {
  //       clearInterval(intervalId);
  //     }
  //   };
  // }, [isAvailable]); // Removido 'loading' para evitar bucle infinito

  const loadInitialData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadAvailableOrders(),
        loadActiveDeliveries(),
        loadTodayStats()
      ]);
      
      // Verificar si hay entregas activas y navegar automáticamente
      await checkAndNavigateToActiveDelivery();
    } catch (error) {
      console.error('Error cargando datos iniciales:', error);
    } finally {
      setLoading(false);
    }
  };


  const checkAndNavigateToActiveDelivery = async () => {
    try {
      // Primero verificar storage local
      const localActiveDelivery = await ActiveDeliveryManager.getActiveDelivery();
      console.log('📱 Entrega local encontrada:', localActiveDelivery);
      
      // Luego verificar servidor con retry logic para error 429
      let response;
      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount < maxRetries) {
        try {
          response = await apiClient.get('/delivery/active');
          break; // Si es exitoso, salir del loop
        } catch (error) {
          if (error.response?.status === 429 && retryCount < maxRetries - 1) {
            console.log(`⏳ Rate limit hit, esperando ${(retryCount + 1) * 2} segundos antes de reintentar...`);
            await new Promise(resolve => setTimeout(resolve, (retryCount + 1) * 2000));
            retryCount++;
          } else {
            throw error; // Re-lanzar si no es 429 o si ya se agotaron los reintentos
          }
        }
      }
      
      console.log('📡 Respuesta del servidor /delivery/active:', {
        success: response?.data?.success,
        deliveriesCount: response?.data?.data?.deliveries?.length,
        deliveries: response?.data?.data?.deliveries
      });
      
      if (response?.data?.success && response.data.data?.deliveries?.length > 0) {
        const activeDelivery = response.data.data.deliveries[0];
        console.log('🚚 Primera entrega activa:', {
          id: activeDelivery._id,
          orderId: activeDelivery.orderId,
          status: activeDelivery.status
        });
        
        // Solo navegar si está en estados intermedios (no completado) Y tiene orderId válido
        const nonCompletedStates = ['assigned', 'heading_to_pickup', 'at_pickup', 'picked_up', 'heading_to_delivery', 'at_delivery'];
        
        // Validar que el delivery tenga un orderId válido
        const orderIdToUse = typeof activeDelivery.orderId === 'object' ? 
          activeDelivery.orderId._id : activeDelivery.orderId;
          
        // Verificaciones adicionales de seguridad
        const hasValidOrder = orderIdToUse && orderIdToUse !== null && orderIdToUse !== 'undefined';
        const hasValidTracking = activeDelivery._id && activeDelivery._id !== null;
        const isValidStatus = nonCompletedStates.includes(activeDelivery.status);
        
        console.log('🔍 Verificaciones de entrega activa:', {
          hasValidOrder,
          hasValidTracking,
          isValidStatus,
          orderIdToUse,
          trackingId: activeDelivery._id,
          status: activeDelivery.status
        });
        
        if (isValidStatus && hasValidOrder && hasValidTracking) {
          console.log('🚚 Entrega activa válida detectada en servidor, navegando automáticamente al mapa...');
          
          // Guardar/actualizar usando el manager
          await ActiveDeliveryManager.setActiveDelivery({
            trackingId: activeDelivery._id,
            orderId: orderIdToUse,
            status: activeDelivery.status
          });
          
          // Navegar automáticamente sin mostrar alerta
          console.log('🔄 Navegando directamente a DeliveryNavigation con:', {
            trackingId: activeDelivery._id,
            orderId: orderIdToUse
          });
          
          // Usar setTimeout para asegurar que la navegación ocurra después del render
          setTimeout(() => {
            navigation.replace('DeliveryNavigation', {
              trackingId: activeDelivery._id,
              orderId: orderIdToUse
            });
          }, 100);
          return; // Salir para evitar limpiar el storage
        } else {
          console.log('⚠️ Entrega activa no válida o completada, limpiando storage local:', {
            reason: !isValidStatus ? 'estado inválido' : 
                   !hasValidOrder ? 'orderId inválido' : 
                   !hasValidTracking ? 'trackingId inválido' : 'desconocido'
          });
          await ActiveDeliveryManager.clearActiveDelivery();
        }
      } else {
        console.log('⚠️ No hay entregas activas en el servidor o respuesta vacía');
        if (!response?.data?.success) {
          console.log('❌ La respuesta no fue exitosa:', response?.data);
        }
      }
      
      if (localActiveDelivery && !response?.data?.data?.deliveries?.length) {
        // Si hay entrega local pero no en servidor, verificar individualmente
        console.log('🔍 Verificando entrega local con servidor...');
        try {
          const trackingResponse = await apiClient.get(`/delivery/${localActiveDelivery.trackingId}`);
          if (trackingResponse.data.success) {
            const trackingData = trackingResponse.data.data.deliveryTracking;
            const nonCompletedStates = ['assigned', 'heading_to_pickup', 'at_pickup', 'picked_up', 'heading_to_delivery', 'at_delivery'];
            
            if (nonCompletedStates.includes(trackingData.status)) {
              console.log('✅ Entrega local confirmada en servidor, navegando...');
              // Actualizar estado y navegar
              await ActiveDeliveryManager.updateActiveDeliveryStatus(trackingData.status);
              navigation.replace('DeliveryNavigation', {
                trackingId: localActiveDelivery.trackingId,
                orderId: localActiveDelivery.orderId
              });
              return;
            } else {
              console.log('⚠️ Entrega local ya está completada, limpiando...');
              await ActiveDeliveryManager.clearActiveDelivery();
            }
          } else {
            console.log('⚠️ Entrega local no encontrada en servidor, limpiando...');
            await ActiveDeliveryManager.clearActiveDelivery();
          }
        } catch (error) {
          console.error('❌ Error verificando entrega local:', error);
          // En caso de error de red, usar datos locales
          console.log('📱 Usando entrega local por error de red');
          navigation.replace('DeliveryNavigation', {
            trackingId: localActiveDelivery.trackingId,
            orderId: localActiveDelivery.orderId
          });
          return;
        }
      } else {
        console.log('📭 No hay entregas activas ni locales ni en servidor');
        await ActiveDeliveryManager.clearActiveDelivery();
      }
    } catch (error) {
      console.error('Error verificando entregas activas:', error);
      
      // En caso de error de red, verificar solo storage local
      const localActiveDelivery = await ActiveDeliveryManager.getActiveDelivery();
      if (localActiveDelivery) {
        console.log('📱 Error de servidor, usando datos locales');
        navigation.replace('DeliveryNavigation', {
          trackingId: localActiveDelivery.trackingId,
          orderId: localActiveDelivery.orderId
        });
      }
    }
  };

  const loadAvailableOrders = async () => {
    try {
      const response = await apiClient.get('/delivery/orders/available');
      if (response.data.success) {
        setAvailableOrders(response.data.orders || []);
      }
    } catch (error) {
      console.error('Error cargando pedidos disponibles:', error);
    }
  };

  const loadActiveDeliveries = async () => {
    try {
      console.log('📡 Cargando deliveries activos...');
      const response = await apiClient.get('/delivery/active');
      console.log('📦 Respuesta de deliveries activos:', response.data);
      
      if (response.data.success) {
        const deliveries = response.data.data?.deliveries || [];
        console.log(`✅ Deliveries activos cargados: ${deliveries.length}`);
        setActiveDeliveries(deliveries);
        
        // Si hay entregas activas, mostrar información y validar integridad
        if (deliveries.length > 0) {
          const validDeliveries = [];
          const invalidDeliveries = [];
          
          deliveries.forEach((d, i) => {
            if (!d.orderId) {
              console.error(`❌ Delivery ${i + 1} (${d._id}) has null orderId - Status: ${d.status}`);
              invalidDeliveries.push(d);
            } else {
              console.log(`  Delivery ${i + 1}: ${d.orderId?.orderNumber || 'Sin número'} - Status: ${d.status}`);
              validDeliveries.push(d);
            }
          });
          
          if (invalidDeliveries.length > 0) {
            console.error(`❌ Found ${invalidDeliveries.length} deliveries with data integrity issues`);
            // Only set valid deliveries to prevent crashes
            setActiveDeliveries(validDeliveries);
          } else {
            setActiveDeliveries(deliveries);
          }
        } else {
          setActiveDeliveries(deliveries);
        }
      }
    } catch (error) {
      console.error('❌ Error cargando deliveries activos:', error.message);
      // Si hay error 429, reintentar
      if (error.response?.status === 429) {
        console.log('⏳ Rate limit, reintentando en 2 segundos...');
        setTimeout(() => loadActiveDeliveries(), 2000);
      }
    }
  };

  const loadTodayStats = async () => {
    try {
      const response = await apiClient.get('/delivery/stats?period=1');
      if (response.data.success && response.data.data) {
        // Asegurar que todos los campos tengan valores por defecto
        const stats = {
          totalDeliveries: response.data.data.totalDeliveries || 0,
          completedDeliveries: response.data.data.completedDeliveries || 0,
          totalEarnings: response.data.data.earnings || 0,
          averageRating: response.data.data.averageRating || 0
        };
        setTodayStats(stats);
      }
    } catch (error) {
      console.error('Error cargando estadísticas:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadInitialData();
    setRefreshing(false);
  };

  const handleLogout = async () => {
    try {
      Alert.alert(
        'Cerrar Sesión',
        '¿Estás seguro de que quieres cerrar sesión?',
        [
          {
            text: 'Cancelar',
            style: 'cancel'
          },
          {
            text: 'Cerrar Sesión',
            style: 'destructive',
            onPress: async () => {
              try {
                setShowProfileMenu(false);
                await AsyncStorage.multiRemove(['token', 'userData', 'user']);
                
                // Limpiar entrega activa
                await ActiveDeliveryManager.clearActiveDelivery();
                
                console.log('🚪 Sesión cerrada, navegando a UserType');
                
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'UserType' }],
                });
              } catch (error) {
                console.error('❌ Error cerrando sesión:', error);
                Alert.alert('Error', 'Hubo un problema cerrando la sesión');
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('❌ Error en logout:', error);
    }
  };

  const toggleAvailability = async (value) => {
    try {
      const response = await apiClient.put('/delivery/availability', {
        isAvailable: value
      });
      
      if (response.data.success) {
        setIsAvailable(value);
        if (value) {
          // Recargar pedidos disponibles cuando se vuelve disponible
          loadAvailableOrders();
        }
      }
    } catch (error) {
      console.error('Error cambiando disponibilidad:', error);
      Alert.alert('Error', 'No se pudo cambiar tu disponibilidad');
    }
  };

  const handleAcceptOrder = async (orderId) => {
    try {
      const response = await apiClient.post(`/delivery/orders/${orderId}/accept`);
      
      if (response.data.success) {
        console.log('✅ Pedido aceptado exitosamente:', response.data);
        
        // Verificar si tenemos datos de tracking
        if (response.data.tracking && response.data.tracking._id) {
          // Caso normal: tracking devuelto en la respuesta
          await ActiveDeliveryManager.setActiveDelivery({
            trackingId: response.data.tracking._id,
            orderId: orderId,
            status: response.data.tracking.status || 'assigned'
          });
          
          navigation.navigate('DeliveryNavigation', {
            trackingId: response.data.tracking._id,
            orderId: orderId,
            deliveryTracking: response.data.tracking
          });
        } else {
          // Caso alternativo: no hay tracking en respuesta, cargar datos manualmente
          console.log('⚠️ No se recibió tracking en respuesta, cargando datos...');
          
          // Recargar datos primero
          await loadInitialData();
          
          // Esperar un momento y luego intentar obtener el tracking
          setTimeout(async () => {
            try {
              const trackingResponse = await apiClient.get(`/delivery/order/${orderId}`);
              if (trackingResponse.data.success && trackingResponse.data.data) {
                const tracking = trackingResponse.data.data.deliveryTracking;
                
                await ActiveDeliveryManager.setActiveDelivery({
                  trackingId: tracking._id,
                  orderId: orderId,
                  status: tracking.status || 'assigned'
                });
                
                navigation.navigate('DeliveryNavigation', {
                  trackingId: tracking._id,
                  orderId: orderId,
                  deliveryTracking: tracking
                });
              } else {
                console.log('⚠️ No se pudo obtener datos de tracking');
                Alert.alert('Aviso', 'Pedido aceptado, pero no se pudo cargar el tracking automáticamente. Revisa tus entregas activas.');
              }
            } catch (trackingError) {
              console.error('Error obteniendo tracking:', trackingError);
              Alert.alert('Aviso', 'Pedido aceptado exitosamente. Ve a "Entregas Activas" para continuar.');
            }
          }, 1000);
        }
        
        // Recargar datos en segundo plano
        loadInitialData();
      }
    } catch (error) {
      console.error('Error aceptando pedido:', error);
      
      let errorMessage = 'No se pudo aceptar el pedido';
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      }
      
      Alert.alert('Error', errorMessage);
      
      // Recargar datos para actualizar la lista
      loadAvailableOrders();
    }
  };

  const handleRejectOrder = async (orderId, reason = '') => {
    try {
      await apiClient.post(`/delivery/orders/${orderId}/reject`, { reason });
      // Remover de la lista
      setAvailableOrders(prev => prev.filter(order => order._id !== orderId));
    } catch (error) {
      console.error('Error rechazando pedido:', error);
    }
  };

  const formatDistance = (distance) => {
    if (!distance || isNaN(distance)) return '0m';
    if (distance < 1) {
      return `${(distance * 1000).toFixed(0)}m`;
    }
    return `${distance.toFixed(1)}km`;
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount) => {
    if (!amount || isNaN(amount)) return 'RD$0';
    return `RD$${amount.toFixed(0)}`;
  };

  const openNavigation = (coordinates, address) => {
    if (!coordinates || coordinates.length !== 2) {
      Alert.alert('Error', 'Coordenadas no disponibles para navegación');
      return;
    }

    const [longitude, latitude] = coordinates;
    const destination = `${latitude},${longitude}`;
    
    Alert.alert(
      'Abrir Navegación',
      `¿Con qué aplicación deseas navegar a: ${address}?`,
      [
        {
          text: 'Google Maps',
          onPress: () => {
            const url = `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
            Linking.openURL(url).catch(() => {
              Alert.alert('Error', 'No se pudo abrir Google Maps');
            });
          }
        },
        {
          text: 'Apple Maps',
          onPress: () => {
            const url = `http://maps.apple.com/?daddr=${destination}`;
            Linking.openURL(url).catch(() => {
              Alert.alert('Error', 'No se pudo abrir Apple Maps');
            });
          }
        },
        {
          text: 'Waze',
          onPress: () => {
            const url = `https://waze.com/ul?ll=${destination}&navigate=yes`;
            Linking.openURL(url).catch(() => {
              Alert.alert('Error', 'No se pudo abrir Waze');
            });
          }
        },
        {
          text: 'Cancelar',
          style: 'cancel'
        }
      ]
    );
  };

  const renderOrderCard = ({ item: order }) => (
    <View style={styles.orderCard}>
      <View style={styles.orderHeader}>
        <Text style={styles.orderNumber}>#{order.orderNumber}</Text>
        <View style={styles.orderAmount}>
          <Text style={styles.amountText}>{formatCurrency(order.total)}</Text>
        </View>
      </View>

      <View style={styles.orderDetails}>
        <View style={styles.detailRow}>
          <Icon name="storefront-outline" size={16} color="#666" />
          <Text style={styles.detailText}>{order.merchantInfo?.name || 'Comerciante'}</Text>
        </View>
        
        <View style={styles.detailRow}>
          <Icon name="location-outline" size={16} color="#E60023" />
          <View style={styles.locationContainer}>
            <Text style={styles.detailText} numberOfLines={2}>
              📍 Recoger: {order.merchantInfo?.fullPickupAddress || order.merchantInfo?.address || 'Dirección no disponible'}
            </Text>
            {order.merchantInfo?.coordinates && (
              <TouchableOpacity
                style={styles.navigationButton}
                onPress={() => openNavigation(
                  order.merchantInfo.coordinates,
                  order.merchantInfo.fullPickupAddress || order.merchantInfo.address || 'Ubicación del comerciante'
                )}
              >
                <Icon name="navigate" size={16} color="#4CAF50" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.detailRow}>
          <Icon name="home-outline" size={16} color="#666" />
          <View style={styles.locationContainer}>
            <Text style={styles.detailText} numberOfLines={2}>
              🏠 Entregar: {order.deliveryInfo?.address?.street ? 
                `${order.deliveryInfo.address.street}, ${order.deliveryInfo.address.city}` : 
                'Dirección de entrega'}
            </Text>
            {order.deliveryInfo?.coordinates && order.deliveryInfo.coordinates.length === 2 && (
              <TouchableOpacity
                style={styles.navigationButton}
                onPress={() => openNavigation(
                  order.deliveryInfo.coordinates,
                  order.deliveryInfo.address?.street ? 
                    `${order.deliveryInfo.address.street}, ${order.deliveryInfo.address.city}` : 
                    'Dirección de entrega'
                )}
              >
                <Icon name="navigate" size={16} color="#2196F3" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.detailRow}>
          <Icon name="cash-outline" size={16} color="#4CAF50" />
          <Text style={[styles.detailText, { color: '#4CAF50', fontWeight: '600' }]}>
            Ganancia est: {formatCurrency(order.estimatedEarning || Math.round(order.total * 0.1))}
          </Text>
        </View>
      </View>

      <View style={styles.orderActions}>
        <TouchableOpacity
          style={styles.rejectButton}
          onPress={() => handleRejectOrder(order._id)}
        >
          <Icon name="close" size={20} color="#F44336" />
          <Text style={styles.rejectText}>Rechazar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.acceptButton}
          onPress={() => handleAcceptOrder(order._id)}
        >
          <Icon name="checkmark" size={20} color="#FFF" />
          <Text style={styles.acceptText}>Aceptar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderActiveDelivery = ({ item: delivery }) => (
    <TouchableOpacity
      style={styles.activeDeliveryCard}
      onPress={() => {
        // Validate delivery data before navigation
        if (!delivery.orderId) {
          console.error('❌ Cannot navigate: delivery has no orderId', delivery);
          Alert.alert(
            'Error de Datos',
            'Esta entrega tiene datos incompletos. Por favor contacta soporte.',
            [{ text: 'OK' }]
          );
          return;
        }
        
        const orderIdValue = typeof delivery.orderId === 'object' ? delivery.orderId._id : delivery.orderId;
        
        if (!orderIdValue) {
          console.error('❌ Cannot navigate: invalid orderId structure', delivery.orderId);
          Alert.alert(
            'Error de Datos', 
            'Los datos de esta entrega están corruptos. Contacta soporte.',
            [{ text: 'OK' }]
          );
          return;
        }
        
        console.log('🚚 Navigating to DeliveryNavigation with:', {
          trackingId: delivery._id,
          orderId: orderIdValue,
          deliveryTracking: delivery
        });
        
        navigation.navigate('DeliveryNavigation', {
          trackingId: delivery._id,
          orderId: orderIdValue,
          deliveryTracking: delivery
        });
      }}
    >
      <View style={styles.activeHeader}>
        <Text style={styles.activeOrderNumber}>
          #{delivery.orderId?.orderNumber || 'Sin número'}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(delivery.status) }]}>
          <Text style={styles.statusText}>{getStatusLabel(delivery.status)}</Text>
        </View>
      </View>

      <Text style={styles.merchantName}>{delivery.merchantId?.business?.businessName || 'Comerciante'}</Text>
      
      <View style={styles.progressContainer}>
        <Text style={styles.progressText}>
          ETA: {delivery.currentETA ? formatTime(delivery.currentETA) : 'Calculando...'}
        </Text>
        {delivery.isRunningLate && (
          <View style={styles.lateIndicator}>
            <Icon name="warning" size={16} color="#FF9800" />
            <Text style={styles.lateText}>Tarde</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  const getStatusColor = (status) => {
    const colors = {
      'assigned': '#9C27B0',
      'heading_to_pickup': '#2196F3',
      'at_pickup': '#FF9800',
      'picked_up': '#3F51B5',
      'heading_to_delivery': '#2196F3',
      'at_delivery': '#4CAF50',
      'delivered': '#4CAF50'
    };
    return colors[status] || '#666';
  };

  const getStatusLabel = (status) => {
    const labels = {
      'assigned': 'Asignado',
      'heading_to_pickup': 'Yendo a recoger',
      'at_pickup': 'En recogida',
      'picked_up': 'Recogido',
      'heading_to_delivery': 'En camino',
      'at_delivery': 'Entregando',
      'delivered': 'Entregado'
    };
    return labels[status] || status;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E60023" />
        <Text style={styles.loadingText}>Cargando dashboard...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.menuButton}
          onPress={() => setShowProfileMenu(true)}
        >
          <Icon name="menu" size={24} color="#333" />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.greeting}>Hola, Delivery</Text>
          <Text style={styles.subtitle}>¿Listo para trabajar?</Text>
        </View>

        <View style={styles.headerRight}>
          <View style={styles.availabilityContainer}>
            <Text style={styles.availabilityLabel}>
              {isAvailable ? 'Disponible' : 'No disponible'}
            </Text>
            <Switch
              value={isAvailable}
              onValueChange={toggleAvailability}
              trackColor={{ false: '#CCC', true: '#E60023' }}
              thumbColor={isAvailable ? '#FFF' : '#FFF'}
            />
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Estadísticas del día */}
        <View style={styles.statsContainer}>
          <Text style={styles.sectionTitle}>Estadísticas de Hoy</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{todayStats.completedDeliveries || 0}</Text>
              <Text style={styles.statLabel}>Entregas</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{formatCurrency(todayStats.totalEarnings)}</Text>
              <Text style={styles.statLabel}>Ganado</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{(todayStats.averageRating || 0).toFixed(1)}</Text>
              <Text style={styles.statLabel}>Rating</Text>
            </View>
          </View>
        </View>

        {/* Deliveries Activos */}
        {activeDeliveries.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Deliveries Activos</Text>
            <FlatList
              data={activeDeliveries}
              renderItem={renderActiveDelivery}
              keyExtractor={(item) => item._id}
              showsVerticalScrollIndicator={false}
              scrollEnabled={false}
            />
          </View>
        )}


        {/* Delivery Activo o Pedidos Disponibles */}
        {activeDeliveries.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Delivery en Curso</Text>
            <TouchableOpacity
              style={styles.activeDeliveryButton}
              onPress={() => {
                const activeDelivery = activeDeliveries[0];
                
                // Validate data before navigation
                if (!activeDelivery.orderId) {
                  console.error('❌ Cannot navigate: active delivery has no orderId', activeDelivery);
                  Alert.alert(
                    'Error de Datos',
                    'La entrega activa tiene datos incompletos. Refrescando...',
                    [{ text: 'OK', onPress: () => loadInitialData() }]
                  );
                  return;
                }
                
                const orderIdValue = typeof activeDelivery.orderId === 'object' ? 
                  activeDelivery.orderId._id : activeDelivery.orderId;
                
                if (!orderIdValue) {
                  console.error('❌ Cannot navigate: invalid orderId in active delivery', activeDelivery.orderId);
                  Alert.alert(
                    'Error de Datos',
                    'Los datos están corruptos. Refrescando...',
                    [{ text: 'OK', onPress: () => loadInitialData() }]
                  );
                  return;
                }
                
                navigation.navigate('DeliveryNavigation', {
                  trackingId: activeDelivery._id,
                  orderId: orderIdValue,
                  deliveryTracking: activeDelivery
                });
              }}
            >
              <View style={styles.activeDeliveryHeader}>
                <Icon name="navigation" size={24} color="#FFF" />
                <Text style={styles.activeDeliveryTitle}>Continuar Delivery</Text>
              </View>
              <Text style={styles.activeDeliverySubtitle}>
                Pedido #{activeDeliveries[0].orderId?.orderNumber || 'Sin número'}
              </Text>
              <Text style={styles.activeDeliveryAction}>
                Toca para abrir el mapa de navegación
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Pedidos Disponibles ({availableOrders.length})
            </Text>
            
            {!isAvailable && (
              <View style={styles.unavailableMessage}>
                <Icon name="pause-circle-outline" size={24} color="#FF9800" />
                <Text style={styles.unavailableText}>
                  Activa tu disponibilidad para ver pedidos
                </Text>
              </View>
            )}

            {isAvailable && availableOrders.length === 0 && (
              <View style={styles.emptyState}>
                <Icon name="time-outline" size={48} color="#CCC" />
                <Text style={styles.emptyText}>No hay pedidos disponibles</Text>
                <Text style={styles.emptySubtext}>Te notificaremos cuando haya nuevos pedidos</Text>
              </View>
            )}

            {isAvailable && availableOrders.length > 0 && (
              <FlatList
                data={availableOrders}
                renderItem={renderOrderCard}
                keyExtractor={(item) => item._id}
                showsVerticalScrollIndicator={false}
                scrollEnabled={false}
              />
            )}
          </View>
        )}
      </ScrollView>

      {/* Modal de Perfil */}
      <Modal
        visible={showProfileMenu}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowProfileMenu(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowProfileMenu(false)}
        >
          <View style={styles.profileMenuContainer}>
            <View style={styles.profileHeader}>
              <Icon name="person-circle" size={40} color="#4CAF50" />
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>Carlos Delivery</Text>
                <Text style={styles.profileEmail}>carlos-delivery@rapigoo.com</Text>
              </View>
            </View>
            
            <View style={styles.menuItems}>
              <TouchableOpacity 
                style={styles.menuItem}
                onPress={() => {
                  setShowProfileMenu(false);
                  navigation.navigate('Profile');
                }}
              >
                <Icon name="person-outline" size={20} color="#333" />
                <Text style={styles.menuItemText}>Mi Perfil</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.menuItem}
                onPress={() => {
                  setShowProfileMenu(false);
                  navigation.navigate('Settings');
                }}
              >
                <Icon name="settings-outline" size={20} color="#333" />
                <Text style={styles.menuItemText}>Configuración</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.menuItem}
                onPress={() => {
                  console.log('🔍 Navegando a DeliveryHistory...');
                  setShowProfileMenu(false);
                  try {
                    navigation.navigate('DeliveryHistory');
                    console.log('✅ Navegación a DeliveryHistory exitosa');
                  } catch (error) {
                    console.error('❌ Error navegando a DeliveryHistory:', error);
                  }
                }}
              >
                <Icon name="list-outline" size={20} color="#333" />
                <Text style={styles.menuItemText}>Mis Entregas</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.menuItem}
                onPress={() => {
                  setShowProfileMenu(false);
                  // Navegar a estadísticas detalladas
                }}
              >
                <Icon name="analytics-outline" size={20} color="#333" />
                <Text style={styles.menuItemText}>Estadísticas</Text>
              </TouchableOpacity>
              
              
              <View style={styles.menuDivider} />
              
              <TouchableOpacity 
                style={[styles.menuItem, styles.logoutItem]}
                onPress={handleLogout}
              >
                <Icon name="exit-outline" size={20} color="#FF4444" />
                <Text style={[styles.menuItemText, styles.logoutText]}>Cerrar Sesión</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  menuButton: {
    padding: 8,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  greeting: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  availabilityContainer: {
    alignItems: 'center',
  },
  availabilityLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  content: {
    flex: 1,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  statsContainer: {
    paddingVertical: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#E60023',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  orderCard: {
    backgroundColor: '#FFF',
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  orderAmount: {
    backgroundColor: '#E60023',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
  },
  amountText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  orderDetails: {
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  detailText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  locationContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navigationButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    marginLeft: 8,
  },
  orderActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rejectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginRight: 8,
    borderRadius: 8,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#F44336',
  },
  rejectText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#F44336',
    fontWeight: '500',
  },
  acceptButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginLeft: 8,
    borderRadius: 8,
    backgroundColor: '#E60023',
  },
  acceptText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#FFF',
    fontWeight: '500',
  },
  activeDeliveryCard: {
    backgroundColor: '#FFF',
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#E60023',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  activeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  activeOrderNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
  },
  statusText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '500',
  },
  merchantName: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  lateIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lateText: {
    marginLeft: 4,
    fontSize: 12,
    color: '#FF9800',
    fontWeight: '500',
  },
  unavailableMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  unavailableText: {
    marginLeft: 12,
    fontSize: 16,
    color: '#FF9800',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
    fontWeight: '500',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 60,
    paddingRight: 20,
  },
  profileMenuContainer: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    minWidth: 250,
    paddingVertical: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  profileInfo: {
    marginLeft: 12,
    flex: 1,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  profileEmail: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  menuItems: {
    paddingTop: 10,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  menuItemText: {
    marginLeft: 12,
    fontSize: 16,
    color: '#333',
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 5,
    marginHorizontal: 20,
  },
  logoutItem: {
    marginTop: 5,
  },
  logoutText: {
    color: '#FF4444',
  },
  activeDeliveryButton: {
    backgroundColor: '#E60023',
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  activeDeliveryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  activeDeliveryTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  activeDeliverySubtitle: {
    color: '#FFF',
    fontSize: 14,
    opacity: 0.9,
    marginBottom: 4,
  },
  activeDeliveryAction: {
    color: '#FFF',
    fontSize: 12,
    opacity: 0.8,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default HomeDeliveryScreen;