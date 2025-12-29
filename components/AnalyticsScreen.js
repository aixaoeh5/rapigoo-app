import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Dimensions
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import apiClient from '../api/apiClient';
import { useTheme } from './context/ThemeContext';
import LoadingState from './shared/LoadingState';
import ErrorState from './shared/ErrorState';

const { width } = Dimensions.get('window');

const AnalyticsScreen = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [analytics, setAnalytics] = useState({
    totalOrders: 0,
    totalRevenue: 0,
    averageOrderValue: 0,
    completedOrders: 0,
    cancelledOrders: 0,
    rating: 0,
    totalReviews: 0,
    topServices: [],
    recentOrders: [],
    monthlyStats: []
  });
  const [selectedPeriod, setSelectedPeriod] = useState('month'); // week, month, year

  useEffect(() => {
    loadAnalytics();
  }, [selectedPeriod]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiClient.get('/orders/stats/merchant', {
        params: { period: selectedPeriod }
      });

      if (response.data.success) {
        setAnalytics(response.data.analytics);
      } else {
        throw new Error('No se pudieron cargar las estadísticas');
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
      setError(error.message || 'Error cargando estadísticas');
      // Datos de ejemplo para demostración
      setAnalytics({
        totalOrders: 47,
        totalRevenue: 12580.50,
        averageOrderValue: 267.67,
        completedOrders: 43,
        cancelledOrders: 4,
        rating: 4.6,
        totalReviews: 32,
        topServices: [
          { name: 'Pollo a la brasa', orders: 15, revenue: 6750 },
          { name: 'Mofongo con pollo', orders: 12, revenue: 3600 },
          { name: 'Tostones con queso', orders: 8, revenue: 2000 }
        ],
        recentOrders: [
          { orderNumber: 'ORD-001', total: 450, status: 'completed', date: '2025-01-10' },
          { orderNumber: 'ORD-002', total: 320, status: 'completed', date: '2025-01-10' },
          { orderNumber: 'ORD-003', total: 580, status: 'in_transit', date: '2025-01-10' }
        ],
        monthlyStats: [
          { period: 'Ene 2025', orders: 47, revenue: 12580 },
          { period: 'Dic 2024', orders: 38, revenue: 9840 },
          { period: 'Nov 2024', orders: 42, revenue: 11200 }
        ]
      });
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAnalytics();
    setRefreshing(false);
  };

  const formatCurrency = (amount) => {
    return `$${amount.toLocaleString('es-DO', { minimumFractionDigits: 2 })} DOP`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return '#4CAF50';
      case 'in_transit': return '#FF9800';
      case 'cancelled': return '#F44336';
      default: return '#2196F3';
    }
  };

  const getStatusText = (status) => {
    const statusMap = {
      'pending': 'Pendiente',
      'confirmed': 'Confirmado',
      'preparing': 'Preparando',
      'ready': 'Listo',
      'in_transit': 'En camino',
      'delivered': 'Entregado',
      'completed': 'Completado',
      'cancelled': 'Cancelado'
    };
    return statusMap[status] || status;
  };

  if (loading) {
    return (
      <LoadingState 
        message="Cargando estadísticas..." 
        color="#FF6B6B"
      />
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Error cargando estadísticas"
        message={error}
        onRetry={loadAnalytics}
      />
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
          Estadísticas
        </Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Period Selector */}
        <View style={styles.periodSelector}>
          {['week', 'month', 'year'].map((period) => (
            <TouchableOpacity
              key={period}
              style={[
                styles.periodButton,
                selectedPeriod === period && styles.periodButtonActive
              ]}
              onPress={() => setSelectedPeriod(period)}
            >
              <Text style={[
                styles.periodButtonText,
                selectedPeriod === period && styles.periodButtonTextActive
              ]}>
                {period === 'week' ? 'Semana' : period === 'month' ? 'Mes' : 'Año'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Key Metrics Cards */}
        <View style={styles.metricsContainer}>
          <View style={styles.metricRow}>
            <View style={[styles.metricCard, styles.revenueCard]}>
              <Icon name="cash-outline" size={32} color="#4CAF50" />
              <Text style={styles.metricValue}>{formatCurrency(analytics.totalRevenue)}</Text>
              <Text style={styles.metricLabel}>Ingresos Totales</Text>
            </View>
            
            <View style={[styles.metricCard, styles.ordersCard]}>
              <Icon name="receipt-outline" size={32} color="#2196F3" />
              <Text style={styles.metricValue}>{analytics.totalOrders}</Text>
              <Text style={styles.metricLabel}>Pedidos Totales</Text>
            </View>
          </View>

          <View style={styles.metricRow}>
            <View style={[styles.metricCard, styles.avgCard]}>
              <Icon name="trending-up-outline" size={32} color="#FF9800" />
              <Text style={styles.metricValue}>{formatCurrency(analytics.averageOrderValue)}</Text>
              <Text style={styles.metricLabel}>Pedido Promedio</Text>
            </View>
            
            <View style={[styles.metricCard, styles.ratingCard]}>
              <Icon name="star-outline" size={32} color="#FFD700" />
              <Text style={styles.metricValue}>{analytics.rating.toFixed(1)} ⭐</Text>
              <Text style={styles.metricLabel}>{analytics.totalReviews} Reseñas</Text>
            </View>
          </View>
        </View>

        {/* Order Status Distribution */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Estado de Pedidos</Text>
          <View style={styles.statusRow}>
            <View style={styles.statusItem}>
              <View style={[styles.statusDot, { backgroundColor: '#4CAF50' }]} />
              <Text style={styles.statusLabel}>Completados: {analytics.completedOrders}</Text>
            </View>
            <View style={styles.statusItem}>
              <View style={[styles.statusDot, { backgroundColor: '#F44336' }]} />
              <Text style={styles.statusLabel}>Cancelados: {analytics.cancelledOrders}</Text>
            </View>
          </View>
        </View>

        {/* Top Services */}
        {analytics.topServices.length > 0 && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Servicios Más Populares</Text>
            {analytics.topServices.map((service, index) => (
              <View key={index} style={styles.serviceItem}>
                <View style={styles.serviceInfo}>
                  <Text style={styles.serviceName}>{service.name}</Text>
                  <Text style={styles.serviceStats}>
                    {service.orders} pedidos • {formatCurrency(service.revenue)}
                  </Text>
                </View>
                <View style={styles.serviceRank}>
                  <Text style={styles.rankText}>#{index + 1}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Recent Orders */}
        {analytics.recentOrders.length > 0 && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Pedidos Recientes</Text>
            {analytics.recentOrders.map((order, index) => (
              <View key={index} style={styles.orderItem}>
                <View style={styles.orderInfo}>
                  <Text style={styles.orderNumber}>{order.orderNumber}</Text>
                  <Text style={styles.orderDate}>{order.date}</Text>
                </View>
                <View style={styles.orderRight}>
                  <Text style={styles.orderTotal}>{formatCurrency(order.total)}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) }]}>
                    <Text style={styles.statusBadgeText}>{getStatusText(order.status)}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Monthly Trends */}
        {analytics.monthlyStats.length > 0 && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Tendencia Mensual</Text>
            {analytics.monthlyStats.map((stat, index) => (
              <View key={index} style={styles.trendItem}>
                <Text style={styles.trendPeriod}>{stat.period}</Text>
                <View style={styles.trendStats}>
                  <Text style={styles.trendOrders}>{stat.orders} pedidos</Text>
                  <Text style={styles.trendRevenue}>{formatCurrency(stat.revenue)}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  periodSelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    margin: 20,
    backgroundColor: '#f5f5f5',
    borderRadius: 25,
    padding: 4,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    alignItems: 'center',
  },
  periodButtonActive: {
    backgroundColor: '#FF6B6B',
  },
  periodButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  periodButtonTextActive: {
    color: '#fff',
  },
  metricsContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  metricCard: {
    flex: 0.48,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  sectionCard: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 12,
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  statusLabel: {
    fontSize: 14,
    color: '#666',
  },
  serviceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  serviceInfo: {
    flex: 1,
  },
  serviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  serviceStats: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  serviceRank: {
    backgroundColor: '#FF6B6B',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  orderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  orderInfo: {
    flex: 1,
  },
  orderNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  orderDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  orderRight: {
    alignItems: 'flex-end',
  },
  orderTotal: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  statusBadgeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
  },
  trendItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  trendPeriod: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  trendStats: {
    alignItems: 'flex-end',
  },
  trendOrders: {
    fontSize: 14,
    color: '#666',
  },
  trendRevenue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  bottomPadding: {
    height: 20,
  },
});

export default AnalyticsScreen;