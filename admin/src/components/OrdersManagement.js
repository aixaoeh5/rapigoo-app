import React, { useState, useEffect } from 'react';
import axios from 'axios';

const OrdersManagement = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const ORDER_STATES = {
    pending: { title: 'Pendiente', color: '#FFA500', bg: '#FFF3E0' },
    confirmed: { title: 'Confirmado', color: '#4CAF50', bg: '#E8F5E8' },
    preparing: { title: 'Preparando', color: '#2196F3', bg: '#E3F2FD' },
    ready: { title: 'Listo', color: '#FF9800', bg: '#FFF8E1' },
    completed: { title: 'Completado', color: '#4CAF50', bg: '#E8F5E8' },
    delivered: { title: 'Entregado', color: '#4CAF50', bg: '#E8F5E8' },
    cancelled: { title: 'Cancelado', color: '#F44336', bg: '#FFEBEE' },
    assigned: { title: 'Asignado', color: '#9C27B0', bg: '#F3E5F5' },
    picked_up: { title: 'Recogido', color: '#FF5722', bg: '#FFF3E0' },
    in_transit: { title: 'En tránsito', color: '#607D8B', bg: '#ECEFF1' }
  };

  useEffect(() => {
    fetchOrders();
  }, [selectedStatus]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await axios.get('http://localhost:5000/api/orders/admin/all', {
        params: {
          status: selectedStatus === 'all' ? undefined : selectedStatus,
          search: searchTerm || undefined,
          limit: 100
        }
      });

      if (response.data.success) {
        setOrders(response.data.orders);
      }
    } catch (error) {
      console.error('Error cargando pedidos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    fetchOrders();
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('es', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTimeSince = (dateString) => {
    const now = new Date();
    const orderDate = new Date(dateString);
    const diffMinutes = Math.floor((now - orderDate) / (1000 * 60));
    
    if (diffMinutes < 60) {
      return `${diffMinutes} min`;
    } else if (diffMinutes < 1440) {
      const diffHours = Math.floor(diffMinutes / 60);
      return `${diffHours}h ${diffMinutes % 60}min`;
    } else {
      const diffDays = Math.floor(diffMinutes / 1440);
      return `${diffDays} día${diffDays > 1 ? 's' : ''}`;
    }
  };

  const filteredOrders = orders.filter(order => {
    if (searchTerm) {
      return (
        order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customerInfo?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.merchantName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    return true;
  });

  if (loading) {
    return (
      <div style={styles.loading}>
        <p>Cargando pedidos...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Gestión de Pedidos</h2>
        <p style={styles.subtitle}>Vista general de todos los pedidos del sistema</p>
      </div>

      {/* Filtros y búsqueda */}
      <div style={styles.filtersContainer}>
        <div style={styles.searchContainer}>
          <input
            type="text"
            placeholder="Buscar por número de pedido, cliente o comerciante..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            style={styles.searchInput}
          />
          <button onClick={handleSearch} style={styles.searchButton}>
            🔍 Buscar
          </button>
        </div>

        <div style={styles.statusFilters}>
          {[
            { key: 'all', label: 'Todos' },
            { key: 'pending', label: 'Pendientes' },
            { key: 'confirmed', label: 'Confirmados' },
            { key: 'preparing', label: 'Preparando' },
            { key: 'ready', label: 'Listos' },
            { key: 'completed', label: 'Completados' },
            { key: 'cancelled', label: 'Cancelados' }
          ].map(status => (
            <button
              key={status.key}
              onClick={() => setSelectedStatus(status.key)}
              style={{
                ...styles.filterButton,
                ...(selectedStatus === status.key ? styles.filterButtonActive : {})
              }}
            >
              {status.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de pedidos */}
      <div style={styles.ordersContainer}>
        {filteredOrders.length === 0 ? (
          <div style={styles.emptyState}>
            <h3>No se encontraron pedidos</h3>
            <p>Intenta cambiar los filtros o realizar una nueva búsqueda</p>
          </div>
        ) : (
          filteredOrders.map(order => {
            const stateConfig = ORDER_STATES[order.status] || { title: order.status || 'Desconocido', color: '#666', bg: '#f5f5f5' };
            const totalItems = order.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;

            return (
              <div key={order._id} style={styles.orderCard}>
                <div style={styles.orderHeader}>
                  <div style={styles.orderInfo}>
                    <h3 style={styles.orderNumber}>#{order.orderNumber}</h3>
                    <p style={styles.orderMeta}>
                      {formatDate(order.createdAt)} • Hace {getTimeSince(order.createdAt)}
                    </p>
                  </div>
                  <div style={{
                    ...styles.statusBadge, 
                    backgroundColor: stateConfig.bg, 
                    color: stateConfig.color
                  }}>
                    {stateConfig.title}
                  </div>
                </div>

                <div style={styles.orderDetails}>
                  <div style={styles.detailRow}>
                    <span style={styles.label}>👤 Cliente:</span>
                    <span>{order.customerInfo?.name || 'N/A'}</span>
                  </div>
                  <div style={styles.detailRow}>
                    <span style={styles.label}>📞 Teléfono:</span>
                    <span>{order.customerInfo?.phone || 'N/A'}</span>
                  </div>
                  <div style={styles.detailRow}>
                    <span style={styles.label}>🏪 Comerciante:</span>
                    <span>{order.merchantName}</span>
                  </div>
                  <div style={styles.detailRow}>
                    <span style={styles.label}>📍 Dirección:</span>
                    <span>{order.deliveryInfo?.address || 'N/A'}</span>
                  </div>
                  <div style={styles.detailRow}>
                    <span style={styles.label}>💰 Total:</span>
                    <span style={styles.price}>${order.total?.toFixed(2) || '0.00'}</span>
                  </div>
                  <div style={styles.detailRow}>
                    <span style={styles.label}>📦 Items:</span>
                    <span>{totalItems} producto{totalItems !== 1 ? 's' : ''}</span>
                  </div>
                  <div style={styles.detailRow}>
                    <span style={styles.label}>💳 Pago:</span>
                    <span>{order.paymentMethod === 'cash' ? '💵 Efectivo' : '🏦 Transferencia'}</span>
                  </div>
                </div>

                {order.deliveryInfo?.instructions && (
                  <div style={styles.instructions}>
                    <span style={styles.label}>📝 Instrucciones:</span>
                    <p>{order.deliveryInfo.instructions}</p>
                  </div>
                )}

                {order.items && order.items.length > 0 && (
                  <div style={styles.itemsList}>
                    <span style={styles.label}>Productos:</span>
                    <ul style={styles.items}>
                      {order.items.slice(0, 3).map((item, index) => (
                        <li key={index} style={styles.item}>
                          {item.quantity}x {item.serviceName} - ${item.totalPrice?.toFixed(2) || '0.00'}
                        </li>
                      ))}
                      {order.items.length > 3 && (
                        <li style={styles.moreItems}>
                          +{order.items.length - 3} productos más...
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <div style={styles.summary}>
        <p>Mostrando {filteredOrders.length} pedido{filteredOrders.length !== 1 ? 's' : ''}</p>
      </div>
    </div>
  );
};

const styles = {
  container: {
    maxWidth: '1200px',
    margin: '0 auto'
  },
  header: {
    marginBottom: '30px'
  },
  title: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#333',
    marginBottom: '5px'
  },
  subtitle: {
    color: '#666',
    fontSize: '16px'
  },
  loading: {
    textAlign: 'center',
    padding: '50px',
    fontSize: '18px',
    color: '#666'
  },
  filtersContainer: {
    backgroundColor: '#fff',
    padding: '20px',
    borderRadius: '12px',
    marginBottom: '20px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
  },
  searchContainer: {
    display: 'flex',
    gap: '10px',
    marginBottom: '20px'
  },
  searchInput: {
    flex: 1,
    padding: '12px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '16px'
  },
  searchButton: {
    padding: '12px 20px',
    backgroundColor: '#2196F3',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '16px'
  },
  statusFilters: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap'
  },
  filterButton: {
    padding: '8px 16px',
    border: '1px solid #ddd',
    backgroundColor: '#fff',
    borderRadius: '20px',
    cursor: 'pointer',
    fontSize: '14px'
  },
  filterButtonActive: {
    backgroundColor: '#2196F3',
    color: 'white',
    borderColor: '#2196F3'
  },
  ordersContainer: {
    display: 'grid',
    gap: '15px'
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
    border: '1px solid #e0e0e0'
  },
  orderHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '15px'
  },
  orderInfo: {
    flex: 1
  },
  orderNumber: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#333',
    marginBottom: '5px'
  },
  orderMeta: {
    color: '#666',
    fontSize: '14px',
    margin: 0
  },
  statusBadge: {
    padding: '8px 16px',
    borderRadius: '20px',
    fontSize: '14px',
    fontWeight: '500'
  },
  orderDetails: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '10px',
    marginBottom: '15px'
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between'
  },
  label: {
    fontWeight: '500',
    color: '#555'
  },
  price: {
    fontWeight: 'bold',
    color: '#4CAF50'
  },
  instructions: {
    backgroundColor: '#f8f9fa',
    padding: '10px',
    borderRadius: '6px',
    marginBottom: '15px'
  },
  itemsList: {
    backgroundColor: '#f8f9fa',
    padding: '15px',
    borderRadius: '6px'
  },
  items: {
    margin: '10px 0 0 0',
    paddingLeft: '20px'
  },
  item: {
    marginBottom: '5px',
    color: '#333'
  },
  moreItems: {
    color: '#666',
    fontStyle: 'italic'
  },
  emptyState: {
    textAlign: 'center',
    padding: '50px',
    color: '#666'
  },
  summary: {
    textAlign: 'center',
    marginTop: '20px',
    color: '#666'
  }
};

export default OrdersManagement;