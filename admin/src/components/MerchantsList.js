import React, { useEffect, useState } from 'react';
import axios from 'axios';

const MerchantsList = () => {
  const [merchants, setMerchants] = useState([]);

  useEffect(() => {
    const fetchMerchants = async () => {
      try {
        const res = await axios.get('http://localhost:5000/api/merchant');
        setMerchants(res.data);
      } catch (error) {
        console.error('Error al obtener comerciantes:', error);
      }
    };

    fetchMerchants();
  }, []);
  
const updateStatus = async (id, newStatus) => {
  try {
    await axios.put(`http://localhost:5000/api/merchant/status/${id}`, {
      status: newStatus,
    });

    const updated = merchants.map((m) =>
      m._id === id ? { ...m, merchantStatus: newStatus } : m
    );
    setMerchants(updated);
    alert(`Comerciante ${newStatus} con éxito ✅`);
  } catch (error) {
    console.error(`❌ Error al cambiar estado del comerciante:`, error);
    alert('No se pudo actualizar el estado');
  }
};


  return (
    <div style={{ padding: 20 }}>
      <h3>Solicitudes de Comerciantes</h3>
      {merchants.map((merchant) => {
        const business = merchant.business || {};
        return (
          <div key={merchant._id} style={styles.card}>
            <p><strong>{business.businessName || merchant.name}</strong> ({business.category || 'Sin categoría'})</p>
            <p>Nombre de usuario: {merchant.name}</p>
            <p>Email: {merchant.email}</p>
            <p>Teléfono: {business.phone || merchant.phone || 'No disponible'}</p>
            <p>RNC: {business.rnc || 'No disponible'}</p>
            <p>Dirección: {business.address || 'No disponible'}</p>
            <p>Horario: {business.openHour} - {business.closeHour}</p>
            <p>Redes sociales: {business.socialMedia || 'No disponible'}</p>
            <p>Estado: {merchant.merchantStatus || 'pendiente'}</p>

            <p>Tasa de producción:</p>
            <div style={styles.progressBarBackground}>
              <div
                style={{
                  ...styles.progressBarFill,
                  width: `${merchant.productionRate || 0}%`,
                  backgroundColor:
                    (merchant.productionRate || 0) > 80 ? '#4CAF50' : '#FFC107',
                }}
              />
            </div>
            <p style={{ marginBottom: 10 }}>
              {merchant.productionRate != null ? `${merchant.productionRate}%` : 'No disponible'}
            </p>

            <p>
              Ganancia diaria:{' '}
              <strong>
                {merchant.dailyEarnings != null
                  ? `$${merchant.dailyEarnings.toLocaleString()}`
                  : 'No disponible'}
              </strong>
            </p>

            <p>
              Comisión RAPIGOO:{' '}
              <strong>
                {merchant.commissionPercentage != null
                  ? `${merchant.commissionPercentage}%`
                  : 'No disponible'}
              </strong>
            </p>

            <p>
              Ingreso RAPIGOO:{' '}
              <strong>
                {merchant.dailyEarnings != null &&
                merchant.commissionPercentage != null
                  ? `$${Math.round(
                      (merchant.dailyEarnings * merchant.commissionPercentage) / 100
                    ).toLocaleString()}`
                  : 'No disponible'}
              </strong>
            </p>

            {merchant.merchantStatus === 'pendiente' && (
              <div style={{ marginTop: 10 }}>
                <button
                  onClick={() => updateStatus(merchant._id, 'aprobado')}
                  style={styles.approve}
                >
                  Aprobar
                </button>
                <button
                  onClick={() => updateStatus(merchant._id, 'rechazado')}
                  style={styles.reject}
                >
                  Rechazar
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

const styles = {
  card: {
    border: '1px solid #ccc',
    borderRadius: '8px',
    padding: '15px',
    marginBottom: '20px',
    backgroundColor: '#f9f9f9',
    boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
  },
  approve: {
    backgroundColor: '#4CAF50',
    color: 'white',
    marginRight: '10px',
    padding: '6px 12px',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  reject: {
    backgroundColor: '#f44336',
    color: 'white',
    padding: '6px 12px',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  progressBarBackground: {
    backgroundColor: '#ddd',
    borderRadius: '5px',
    overflow: 'hidden',
    height: '10px',
    marginBottom: '5px',
  },
  progressBarFill: {
    height: '100%',
    transition: 'width 0.3s ease',
  },
};

export default MerchantsList;
