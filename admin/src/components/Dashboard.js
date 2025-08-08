import React, { useState, useEffect } from 'react';
import MerchantsList from './MerchantsList';
import OrdersManagement from './OrdersManagement';
import axios from 'axios';

const Dashboard = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState({
    totalMerchants: 0,
    pendingMerchants: 0,
    activeMerchants: 0,
    totalOrders: 0,
    pendingOrders: 0,
    completedOrders: 0,
    todayRevenue: 0,
    totalRevenue: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      const [merchantsRes, ordersRes] = await Promise.all([
        axios.get('http://localhost:5000/api/merchant/all'),
        axios.get('http://localhost:5000/api/orders/admin/stats')
      ]);

      const merchants = merchantsRes.data || [];
      const ordersData = ordersRes.data?.data || {};

      setStats({
        totalMerchants: merchants.length,
        pendingMerchants: merchants.filter(m => m.merchantStatus === 'pendiente').length,
        activeMerchants: merchants.filter(m => m.merchantStatus === 'aprobado').length,
        totalOrders: ordersData.totalOrders || 0,
        pendingOrders: ordersData.pendingOrders || 0,
        completedOrders: ordersData.completedOrders || 0,
        todayRevenue: ordersData.todayRevenue || 0,
        totalRevenue: ordersData.totalRevenue || 0
      });
    } catch (error) {
      console.error('Error cargando estadísticas:', error);
      // Usar datos de respaldo si hay error
      setStats({
        totalMerchants: 0,
        pendingMerchants: 0,
        activeMerchants: 0,
        totalOrders: 0,
        pendingOrders: 0,
        completedOrders: 0,
        todayRevenue: 0,
        totalRevenue: 0
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">RAPIGOO Admin</div>
        </div>
        <nav className="sidebar-nav">
          <ul>
            <li className="nav-item">
              <button 
                onClick={() => setActiveTab('overview')}
                className={`nav-link ${activeTab === 'overview' ? 'active' : ''}`}
              >
                <span className="nav-icon">📊</span>
                Resumen
              </button>
            </li>
            <li className="nav-item">
              <button 
                onClick={() => setActiveTab('merchants')}
                className={`nav-link ${activeTab === 'merchants' ? 'active' : ''}`}
              >
                <span className="nav-icon">🏪</span>
                Comerciantes
                {stats.pendingMerchants > 0 && (
                  <span className="badge badge-pending">{stats.pendingMerchants}</span>
                )}
              </button>
            </li>
            <li className="nav-item">
              <button 
                onClick={() => setActiveTab('orders')}
                className={`nav-link ${activeTab === 'orders' ? 'active' : ''}`}
              >
                <span className="nav-icon">📋</span>
                Pedidos
              </button>
            </li>
          </ul>
        </nav>
      </div>

      {/* Main Content */}
      <div className="main-content">
        <div className="topbar">
          <h1 className="page-title">
            {activeTab === 'overview' && 'Panel de Control'}
            {activeTab === 'merchants' && 'Gestión de Comerciantes'}
            {activeTab === 'orders' && 'Gestión de Pedidos'}
          </h1>
          <div className="user-menu">
            <button onClick={onLogout} className="btn-logout">
              Cerrar Sesión
            </button>
          </div>
        </div>

        <div className="content-area">
          {activeTab === 'overview' && (
            <div className="fade-in">
              {loading ? (
                <div className="card text-center">
                  <p>Cargando estadísticas...</p>
                </div>
              ) : (
                <>
                  <div className="stats-grid">
                    <div className="stat-card">
                      <div className="stat-title">Comerciantes Totales</div>
                      <div className="stat-value">{stats.totalMerchants}</div>
                      <div className="stat-change">
                        {stats.pendingMerchants} pendientes • {stats.activeMerchants} activos
                      </div>
                    </div>
                    
                    <div className="stat-card">
                      <div className="stat-title">Pedidos Totales</div>
                      <div className="stat-value">{stats.totalOrders}</div>
                      <div className="stat-change">
                        {stats.pendingOrders} pendientes • {stats.completedOrders} completados
                      </div>
                    </div>
                    
                    <div className="stat-card">
                      <div className="stat-title">Ingresos Hoy</div>
                      <div className="stat-value">${stats.todayRevenue.toFixed(0)}</div>
                      <div className="stat-change">
                        Total: ${stats.totalRevenue.toFixed(0)}
                      </div>
                    </div>
                    
                    <div className="stat-card">
                      <div className="stat-title">Tasa de Éxito</div>
                      <div className="stat-value">
                        {stats.totalOrders > 0 ? ((stats.completedOrders / stats.totalOrders) * 100).toFixed(1) : 0}%
                      </div>
                      <div className="stat-change">Pedidos completados</div>
                    </div>
                  </div>

                  <div className="card">
                    <div className="card-header">
                      <h3 className="card-title">Acciones Rápidas</h3>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                      <button 
                        onClick={() => setActiveTab('merchants')}
                        className="btn btn-success"
                      >
                        📊 Gestionar Comerciantes
                      </button>
                      <button 
                        onClick={() => setActiveTab('orders')}
                        className="btn btn-secondary"
                      >
                        📋 Ver Pedidos
                      </button>
                      <button 
                        onClick={fetchDashboardStats}
                        className="btn btn-secondary"
                      >
                        🔄 Actualizar Datos
                      </button>
                    </div>
                  </div>

                  {stats.pendingMerchants > 0 && (
                    <div className="card" style={{ borderLeft: '4px solid var(--warning)' }}>
                      <div className="card-header">
                        <h3 className="card-title">⚠️ Atención Requerida</h3>
                      </div>
                      <p>
                        Tienes <strong>{stats.pendingMerchants}</strong> comerciante
                        {stats.pendingMerchants > 1 ? 's' : ''} pendiente
                        {stats.pendingMerchants > 1 ? 's' : ''} de aprobación.
                      </p>
                      <button 
                        onClick={() => setActiveTab('merchants')}
                        className="btn btn-success btn-sm"
                      >
                        Revisar Solicitudes
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
          
          {activeTab === 'merchants' && <MerchantsList onUpdate={fetchDashboardStats} />}
          {activeTab === 'orders' && <OrdersManagement />}
        </div>
      </div>
    </div>
  );
};


export default Dashboard;
