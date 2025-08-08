import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/Ionicons';
import { apiClient } from '../api/apiClient';
import { useTheme } from './context/ThemeContext';

const HomeComercianteScreen = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const [businessName, setBusinessName] = useState('');
  const [orderStats, setOrderStats] = useState({
    pending: 0,
    preparing: 0,
    ready: 0,
    todayTotal: 0,
    todayOrders: 0
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    console.log('🚀 HomeComercianteScreen montado');
    loadMerchantData();
  }, []);

  const loadMerchantData = async () => {
    if (!refreshing) setLoading(true);
    await Promise.all([
      fetchUserData(),
      fetchOrderStats()
    ]);
    setLoading(false);
    setRefreshing(false);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadMerchantData();
  };

  const fetchUserData = async () => {
    const token = await AsyncStorage.getItem('token');
    if (!token) {
      console.log('⚠️ No hay token guardado');
      return;
    }

    try {
      console.log('📡 Obteniendo datos del usuario...');
      const res = await apiClient.get('/auth/user');
      const data = res.data;
      console.log('✅ Datos del usuario obtenidos:', data.name);

      setBusinessName(data.business?.businessName || data.name || 'Nombre del Negocio');
    } catch (error) {
      console.error('❌ Error obteniendo datos del usuario:', error.message);
      console.error('❌ Status:', error.response?.status);
      console.error('❌ Data:', error.response?.data);
      setBusinessName('Error cargando datos');
    }
  };

  const fetchOrderStats = async () => {
    try {
      console.log('📊 Cargando estadísticas de pedidos...');
      
      // Obtener estadísticas de pedidos por estado
      console.log('📡 Haciendo llamadas a la API...');
      const [pendingRes, preparingRes, readyRes, allOrdersRes] = await Promise.all([
        apiClient.get('/orders/merchant/list?status=pending&limit=100'),
        apiClient.get('/orders/merchant/list?status=preparing&limit=100'),
        apiClient.get('/orders/merchant/list?status=ready&limit=100'),
        apiClient.get('/orders/merchant/list?limit=100')
      ]);
      console.log('✅ Llamadas a la API completadas');

      console.log('✅ Estadísticas cargadas exitosamente');

      // Filtrar pedidos de hoy
      const today = new Date().toISOString().split('T')[0];
      const allOrders = allOrdersRes.data.success ? allOrdersRes.data.orders : [];
      const todayOrders = allOrders.filter(order => 
        new Date(order.createdAt).toISOString().split('T')[0] === today
      );

      const todayRevenue = todayOrders
        .filter(order => order.status === 'completed')
        .reduce((sum, order) => sum + order.total, 0);

      setOrderStats({
        pending: pendingRes.data.success ? pendingRes.data.orders.length : 0,
        preparing: preparingRes.data.success ? preparingRes.data.orders.length : 0,
        ready: readyRes.data.success ? readyRes.data.orders.length : 0,
        todayTotal: todayRevenue,
        todayOrders: todayOrders.length
      });

    } catch (error) {
      console.error('❌ Error cargando estadísticas:', error.message);
      if (error.response) {
        console.error('❌ Status:', error.response.status);
        console.error('❌ Data:', error.response.data);
      }
      if (error.code === 'ECONNABORTED') {
        console.error('❌ Timeout en la conexión');
      }
      
      // Mostrar estadísticas vacías en caso de error
      setOrderStats({
        pending: 0,
        preparing: 0,
        ready: 0,
        todayTotal: 0,
        todayOrders: 0
      });
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollContent: {
      flex: 1,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.colors.background,
    },
    loadingText: {
      marginTop: 10,
      fontSize: 16,
      color: theme.colors.textSecondary,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      paddingHorizontal: 20,
      paddingTop: 60,
      paddingBottom: 20,
      backgroundColor: theme.colors.card,
    },
    welcomeText: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.colors.text,
    },
    businessName: {
      fontSize: 18,
      color: theme.colors.primary,
      fontWeight: '600',
      marginTop: 5,
    },
    dateText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginTop: 5,
      textTransform: 'capitalize',
    },
    refreshButton: {
      padding: 8,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: 15,
    },
    statsContainer: {
      padding: 20,
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      marginBottom: 15,
    },
    statCard: {
      width: '48%',
      backgroundColor: theme.colors.card,
      borderRadius: 12,
      padding: 20,
      alignItems: 'center',
      marginBottom: 12,
      position: 'relative',
      shadowColor: theme.colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    statNumber: {
      fontSize: 28,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginTop: 8,
    },
    statLabel: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginTop: 4,
      textAlign: 'center',
    },
    urgentDot: {
      position: 'absolute',
      top: 10,
      right: 10,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.colors.error,
    },
    summaryCard: {
      backgroundColor: theme.colors.card,
      borderRadius: 8,
      padding: 15,
      alignItems: 'center',
    },
    summaryText: {
      fontSize: 16,
      color: theme.colors.text,
      textAlign: 'center',
    },
    urgentSection: {
      paddingHorizontal: 20,
      paddingBottom: 20,
    },
    urgentCard: {
      backgroundColor: theme.colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 10,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      shadowColor: theme.colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
      borderLeftWidth: 4,
      borderLeftColor: theme.colors.warning,
    },
    urgentCardContent: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    urgentCardText: {
      marginLeft: 12,
      flex: 1,
    },
    urgentCardTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      color: theme.colors.text,
    },
    urgentCardSubtitle: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    optionsSection: {
      paddingHorizontal: 20,
      paddingBottom: 20,
    },
    optionsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
    },
    optionCard: {
      width: '48%',
      backgroundColor: theme.colors.card,
      borderRadius: 12,
      padding: 20,
      alignItems: 'center',
      marginBottom: 12,
      position: 'relative',
      shadowColor: theme.colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    optionText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.text,
      marginTop: 12,
      textAlign: 'center',
    },
    badge: {
      position: 'absolute',
      top: 8,
      right: 8,
      backgroundColor: theme.colors.error,
      borderRadius: 10,
      minWidth: 20,
      height: 20,
      justifyContent: 'center',
      alignItems: 'center',
    },
    badgeText: {
      color: 'white',
      fontSize: 12,
      fontWeight: 'bold',
    },
    bottomPadding: {
      height: 100, // Aumentar padding para evitar solapamiento con navegación
    },
    merchantBottomBar: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: 80,
      flexDirection: 'row',
      justifyContent: 'space-evenly',
      alignItems: 'center',
      backgroundColor: theme.colors.card,
      borderTopLeftRadius: 50,
      borderTopRightRadius: 50,
      paddingHorizontal: 10,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      shadowColor: theme.colors.shadow,
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 5,
    },
    bottomBarItem: {
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      paddingVertical: 5,
    },
    bottomBarText: {
      fontSize: 12,
      color: '#666',
      marginTop: 4,
      fontWeight: '500',
    },
    navBadge: {
      position: 'absolute',
      top: -5,
      right: -10,
      backgroundColor: '#FF6B6B',
      borderRadius: 10,
      minWidth: 20,
      height: 20,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 4,
    },
    navBadgeText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: 'bold',
    },
  });

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Cargando dashboard...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
    <ScrollView 
      style={styles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.welcomeText}>¡Bienvenido!</Text>
          <Text style={styles.businessName}>{businessName}</Text>
          <Text style={styles.dateText}>
            {new Date().toLocaleDateString('es', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </Text>
        </View>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
          <Icon name="refresh-outline" size={24} color="#666" />
        </TouchableOpacity>
      </View>

      {/* Estadísticas rápidas */}
      <View style={styles.statsContainer}>
        <Text style={styles.sectionTitle}>Resumen de hoy</Text>
        
        <View style={styles.statsGrid}>
          <TouchableOpacity 
            style={[styles.statCard, { backgroundColor: '#FFF3E0' }]}
            onPress={() => {
              console.log('🔄 Navegando a OrderManagement...');
              navigation.navigate('OrderManagement');
            }}
          >
            <Icon name="time-outline" size={28} color="#FF9800" />
            <Text style={styles.statNumber}>{orderStats.pending}</Text>
            <Text style={styles.statLabel}>Pendientes</Text>
            {orderStats.pending > 0 && <View style={styles.urgentDot} />}
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.statCard, { backgroundColor: '#E3F2FD' }]}
            onPress={() => navigation.navigate('OrderManagement')}
          >
            <Icon name="restaurant-outline" size={28} color="#2196F3" />
            <Text style={styles.statNumber}>{orderStats.preparing}</Text>
            <Text style={styles.statLabel}>Preparando</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.statCard, { backgroundColor: '#FFF8E1' }]}
            onPress={() => navigation.navigate('OrderManagement')}
          >
            <Icon name="cube-outline" size={28} color="#FFC107" />
            <Text style={styles.statNumber}>{orderStats.ready}</Text>
            <Text style={styles.statLabel}>Listos</Text>
            {orderStats.ready > 0 && <View style={styles.urgentDot} />}
          </TouchableOpacity>

          <View style={[styles.statCard, { backgroundColor: '#E8F5E8' }]}>
            <Icon name="cash-outline" size={28} color="#4CAF50" />
            <Text style={styles.statNumber}>${orderStats.todayTotal.toFixed(0)}</Text>
            <Text style={styles.statLabel}>Ingresos</Text>
          </View>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryText}>
            📊 {orderStats.todayOrders} pedidos hoy • ${orderStats.todayTotal.toFixed(2)} en ventas
          </Text>
        </View>
      </View>

      {/* Acceso rápido a pedidos urgentes */}
      {(orderStats.pending > 0 || orderStats.ready > 0) && (
        <View style={styles.urgentSection}>
          <Text style={styles.sectionTitle}>🚨 Atención requerida</Text>
          
          {orderStats.pending > 0 && (
            <TouchableOpacity 
              style={styles.urgentCard}
              onPress={() => navigation.navigate('OrderManagement')}
            >
              <View style={styles.urgentCardContent}>
                <Icon name="alert-circle-outline" size={24} color="#FF9800" />
                <View style={styles.urgentCardText}>
                  <Text style={styles.urgentCardTitle}>
                    {orderStats.pending} pedido{orderStats.pending > 1 ? 's' : ''} pendiente{orderStats.pending > 1 ? 's' : ''}
                  </Text>
                  <Text style={styles.urgentCardSubtitle}>
                    Necesita{orderStats.pending > 1 ? 'n' : ''} confirmación inmediata
                  </Text>
                </View>
              </View>
              <Icon name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>
          )}

          {orderStats.ready > 0 && (
            <TouchableOpacity 
              style={styles.urgentCard}
              onPress={() => navigation.navigate('OrderManagement')}
            >
              <View style={styles.urgentCardContent}>
                <Icon name="checkmark-circle-outline" size={24} color="#4CAF50" />
                <View style={styles.urgentCardText}>
                  <Text style={styles.urgentCardTitle}>
                    {orderStats.ready} pedido{orderStats.ready > 1 ? 's' : ''} listo{orderStats.ready > 1 ? 's' : ''}
                  </Text>
                  <Text style={styles.urgentCardSubtitle}>
                    Preparado{orderStats.ready > 1 ? 's' : ''} para entrega
                  </Text>
                </View>
              </View>
              <Icon name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Opciones principales */}
      <View style={styles.optionsSection}>
        <Text style={styles.sectionTitle}>Administración</Text>
        
        <View style={styles.optionsGrid}>
          <TouchableOpacity
            style={styles.optionCard}
            onPress={() => {
              console.log('🔄 Botón Gestionar Pedidos presionado');
              navigation.navigate('OrderManagement');
            }}
          >
            <Icon name="receipt-outline" size={32} color="#FF6B6B" />
            <Text style={styles.optionText}>Gestionar Pedidos</Text>
            {(orderStats.pending + orderStats.preparing + orderStats.ready) > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {orderStats.pending + orderStats.preparing + orderStats.ready}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.optionCard}
            onPress={() => {
              console.log('🔄 Botón Mis Servicios presionado');
              navigation.navigate('Services');
            }}
          >
            <Icon name="restaurant-outline" size={32} color="#4CAF50" />
            <Text style={styles.optionText}>Mis Servicios</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.optionCard}
            onPress={() => {
              console.log('🔄 Botón Mi Perfil presionado');
              navigation.navigate('ProfileMerchant');
            }}
          >
            <Icon name="person-outline" size={32} color="#2196F3" />
            <Text style={styles.optionText}>Mi Perfil</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.optionCard}
            onPress={() => {/* TODO: Implementar Analytics */}}
          >
            <Icon name="bar-chart-outline" size={32} color="#9C27B0" />
            <Text style={styles.optionText}>Estadísticas</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.bottomPadding} />
    </ScrollView>

    {/* Navegación de comerciante */}
    <View style={styles.merchantBottomBar}>
      <TouchableOpacity 
        style={styles.bottomBarItem}
        onPress={() => navigation.navigate('HomeComerciante')}
      >
        <Icon name="home" size={24} color="#FF6B6B" />
        <Text style={[styles.bottomBarText, { color: '#FF6B6B' }]}>Inicio</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.bottomBarItem}
        onPress={() => {
          console.log('🔄 Navegación inferior - Pedidos presionado');
          navigation.navigate('OrderManagement');
        }}
      >
        <Icon name="receipt-outline" size={24} color="#666" />
        <Text style={styles.bottomBarText}>Pedidos</Text>
        {(orderStats.pending + orderStats.preparing + orderStats.ready) > 0 && (
          <View style={styles.navBadge}>
            <Text style={styles.navBadgeText}>
              {orderStats.pending + orderStats.preparing + orderStats.ready}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.bottomBarItem}
        onPress={() => navigation.navigate('Services')}
      >
        <Icon name="restaurant-outline" size={24} color="#666" />
        <Text style={styles.bottomBarText}>Servicios</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.bottomBarItem}
        onPress={() => {
          console.log('🔄 Navegación inferior - Perfil presionado');
          navigation.navigate('ProfileMerchant');
        }}
      >
        <Icon name="person-outline" size={24} color="#666" />
        <Text style={styles.bottomBarText}>Perfil</Text>
      </TouchableOpacity>
    </View>
    </View>
  );
};

export default HomeComercianteScreen;
