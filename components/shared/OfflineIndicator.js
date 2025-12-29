// components/shared/OfflineIndicator.js
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import NetInfo from '@react-native-netinfo/netinfo';
import OfflineService from '../../services/OfflineService';

/**
 * Componente indicador de estado offline/online
 * Muestra información sobre conectividad y datos pendientes
 */
const OfflineIndicator = ({ style = {}, onPress = null }) => {
  const [isOnline, setIsOnline] = useState(true);
  const [offlineStats, setOfflineStats] = useState({});
  const [showDetails, setShowDetails] = useState(false);
  
  // Animación para el indicador
  const fadeAnim = new Animated.Value(1);
  const pulseAnim = new Animated.Value(1);

  useEffect(() => {
    // Configurar listener de red
    const unsubscribe = NetInfo.addEventListener(state => {
      const wasOffline = !isOnline;
      setIsOnline(state.isConnected);
      
      // Actualizar estadísticas
      updateOfflineStats();
      
      // Animación cuando cambia el estado
      if (wasOffline !== !state.isConnected) {
        Animated.sequence([
          Animated.timing(fadeAnim, {
            toValue: 0.3,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start();
      }
    });

    // Actualizar estadísticas inicialmente
    updateOfflineStats();

    // Configurar animación de pulso para modo offline
    startPulseAnimation();

    return () => {
      unsubscribe();
    };
  }, []);

  const updateOfflineStats = () => {
    const stats = OfflineService.getOfflineStats();
    setOfflineStats(stats);
  };

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      setShowDetails(!showDetails);
    }
  };

  const handleSyncNow = async () => {
    if (isOnline) {
      await OfflineService.forceSyncNow();
      updateOfflineStats();
    }
  };

  if (isOnline && offlineStats.pendingActions === 0) {
    // Solo mostrar cuando hay algo relevante que mostrar
    return null;
  }

  return (
    <Animated.View style={[styles.container, style, { opacity: fadeAnim }]}>
      <TouchableOpacity
        style={[
          styles.indicator,
          isOnline ? styles.onlineIndicator : styles.offlineIndicator
        ]}
        onPress={handlePress}
        activeOpacity={0.8}
      >
        <Animated.View style={[
          styles.iconContainer,
          !isOnline && { transform: [{ scale: pulseAnim }] }
        ]}>
          <Ionicons
            name={isOnline ? 'cloud-done' : 'cloud-offline'}
            size={16}
            color={isOnline ? '#4CAF50' : '#FF9800'}
          />
        </Animated.View>
        
        <Text style={[
          styles.statusText,
          isOnline ? styles.onlineText : styles.offlineText
        ]}>
          {isOnline ? 'Online' : 'Offline'}
        </Text>
        
        {offlineStats.pendingActions > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{offlineStats.pendingActions}</Text>
          </View>
        )}
      </TouchableOpacity>

      {showDetails && (
        <View style={styles.detailsPanel}>
          <View style={styles.detailsHeader}>
            <Text style={styles.detailsTitle}>Estado de Conectividad</Text>
            <TouchableOpacity onPress={() => setShowDetails(false)}>
              <Ionicons name="close" size={20} color="#666" />
            </TouchableOpacity>
          </View>

          <View style={styles.detailsContent}>
            <View style={styles.detailRow}>
              <Ionicons name="wifi" size={16} color="#666" />
              <Text style={styles.detailLabel}>Conexión:</Text>
              <Text style={[
                styles.detailValue,
                isOnline ? styles.onlineValue : styles.offlineValue
              ]}>
                {isOnline ? 'Conectado' : 'Sin conexión'}
              </Text>
            </View>

            {offlineStats.pendingActions > 0 && (
              <View style={styles.detailRow}>
                <Ionicons name="sync" size={16} color="#666" />
                <Text style={styles.detailLabel}>Pendientes:</Text>
                <Text style={styles.detailValue}>
                  {offlineStats.pendingActions} acciones
                </Text>
              </View>
            )}

            {offlineStats.locationHistoryCount > 0 && (
              <View style={styles.detailRow}>
                <Ionicons name="location" size={16} color="#666" />
                <Text style={styles.detailLabel}>Ubicaciones:</Text>
                <Text style={styles.detailValue}>
                  {offlineStats.locationHistoryCount} guardadas
                </Text>
              </View>
            )}

            {offlineStats.hasOfflineData && (
              <View style={styles.detailRow}>
                <Ionicons name="download" size={16} color="#666" />
                <Text style={styles.detailLabel}>Datos offline:</Text>
                <Text style={styles.detailValue}>Disponibles</Text>
              </View>
            )}

            {isOnline && offlineStats.pendingActions > 0 && (
              <TouchableOpacity
                style={styles.syncButton}
                onPress={handleSyncNow}
              >
                <Ionicons name="sync" size={16} color="#fff" />
                <Text style={styles.syncButtonText}>Sincronizar Ahora</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 1000,
  },
  indicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  onlineIndicator: {
    backgroundColor: '#E8F5E8',
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  offlineIndicator: {
    backgroundColor: '#FFF3E0',
    borderWidth: 1,
    borderColor: '#FF9800',
  },
  iconContainer: {
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  onlineText: {
    color: '#4CAF50',
  },
  offlineText: {
    color: '#FF9800',
  },
  badge: {
    backgroundColor: '#f44336',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  detailsPanel: {
    position: 'absolute',
    top: 40,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 12,
    minWidth: 280,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  detailsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  detailsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  detailsContent: {
    padding: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  onlineValue: {
    color: '#4CAF50',
  },
  offlineValue: {
    color: '#FF9800',
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2196F3',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 8,
  },
  syncButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
});

export default OfflineIndicator;