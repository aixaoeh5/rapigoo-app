import React from 'react';
import MerchantsList from './MerchantsList';
import Navbar from './Navbar';

const Dashboard = ({ onLogout }) => {
  return (
    <div>
      <Navbar onLogout={onLogout} />
      <h2 style={{ textAlign: 'center' }}>Dashboard de Administración</h2>
      <MerchantsList />
    </div>
  );
};

export default Dashboard;
