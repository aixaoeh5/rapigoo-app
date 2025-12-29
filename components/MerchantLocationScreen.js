import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import apiClient from '../api/apiClient';

const MerchantLocationScreen = () => {
  const navigation = useNavigation();
  
  // Estado para el mapa y ubicación
  const [region, setRegion] = useState(null);
  const [markerPosition, setMarkerPosition] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Estado para la información de dirección
  const [pickupAddress, setPickupAddress] = useState({
    street: '',
    city: '',
    state: '',
    zipCode: '',
    landmarks: '',
    instructions: ''
  });

  useEffect(() => {
    initializeLocation();
  }, []);

  const initializeLocation = async () => {
    try {
      setIsLoading(true);
      
      // Solicitar permisos de ubicación
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permisos requeridos', 
          'Necesitamos acceso a tu ubicación para ayudarte a establecer la ubicación de tu negocio.'
        );
        return;
      }

      // Intentar cargar la ubicación existente del comerciante
      await loadExistingLocation();

      // Si no hay ubicación existente, usar la ubicación actual
      if (!markerPosition) {
        const userLocation = await Location.getCurrentPositionAsync({});
        const initialRegion = {
          latitude: userLocation.coords.latitude,
          longitude: userLocation.coords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        };
        setRegion(initialRegion);
        setMarkerPosition({
          latitude: userLocation.coords.latitude,
          longitude: userLocation.coords.longitude,
        });
      }
    } catch (error) {
      console.error('Error inicializando ubicación:', error);
      Alert.alert('Error', 'No se pudo obtener la ubicación');
    } finally {
      setIsLoading(false);
    }
  };

  const loadExistingLocation = async () => {
    try {
      const response = await apiClient.get('/auth/user');
      const userData = response.data;
      
      if (userData.business?.location?.coordinates) {
        const [longitude, latitude] = userData.business.location.coordinates;
        const existingRegion = {
          latitude,
          longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        };
        
        setRegion(existingRegion);
        setMarkerPosition({ latitude, longitude });
        
        // Cargar información de dirección existente
        if (userData.business.pickupAddress) {
          setPickupAddress(userData.business.pickupAddress);
        }
        
        console.log('📍 Ubicación existente cargada:', latitude, longitude);
      }
    } catch (error) {
      console.error('Error cargando ubicación existente:', error);
    }
  };

  const handleMapPress = (event) => {
    const { coordinate } = event.nativeEvent;
    setMarkerPosition(coordinate);
    console.log('📍 Nueva ubicación seleccionada:', coordinate);
  };

  const handleMarkerDrag = (event) => {
    const { coordinate } = event.nativeEvent;
    setMarkerPosition(coordinate);
    console.log('📍 Marcador movido a:', coordinate);
  };

  const saveLocation = async () => {
    if (!markerPosition) {
      Alert.alert('Error', 'Por favor, selecciona una ubicación en el mapa');
      return;
    }

    setIsSaving(true);
    try {
      const requestData = {
        latitude: markerPosition.latitude,
        longitude: markerPosition.longitude,
        pickupAddress
      };

      console.log('📡 Enviando ubicación:', requestData);

      const response = await apiClient.put('/merchant/location', requestData);
      
      if (response.data.success) {
        Alert.alert(
          '✅ Ubicación guardada', 
          'La ubicación de tu negocio ha sido establecida correctamente.',
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack()
            }
          ]
        );
      } else {
        throw new Error(response.data.message || 'Error al guardar ubicación');
      }
    } catch (error) {
      console.error('❌ Error guardando ubicación:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Error al guardar la ubicación';
      Alert.alert('Error', errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const centerOnCurrentLocation = async () => {
    try {
      setIsLoading(true);
      const location = await Location.getCurrentPositionAsync({});
      const newRegion = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
      
      setRegion(newRegion);
      setMarkerPosition({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
    } catch (error) {
      console.error('Error obteniendo ubicación actual:', error);
      Alert.alert('Error', 'No se pudo obtener tu ubicación actual');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B6B" />
        <Text style={styles.loadingText}>Cargando mapa...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ubicación del Negocio</Text>
        <TouchableOpacity 
          style={styles.currentLocationButton} 
          onPress={centerOnCurrentLocation}
        >
          <Ionicons name="locate" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Mapa */}
      <View style={styles.mapContainer}>
        {region && (
          <MapView
            style={styles.map}
            region={region}
            onRegionChange={setRegion}
            onPress={handleMapPress}
            showsUserLocation={true}
            showsMyLocationButton={false}
          >
            {markerPosition && (
              <Marker
                coordinate={markerPosition}
                draggable={true}
                onDragEnd={handleMarkerDrag}
                title="Mi Negocio"
                description="Ubicación de pickup para delivery"
                pinColor="#FF6B6B"
              />
            )}
          </MapView>
        )}
        
        {/* Instrucciones sobre el mapa */}
        <View style={styles.mapInstructions}>
          <Text style={styles.instructionText}>
            📍 Toca en el mapa o arrastra el marcador para establecer la ubicación de tu negocio
          </Text>
        </View>
      </View>

      {/* Información de dirección */}
      <KeyboardAvoidingView 
        style={styles.bottomContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView 
          style={styles.addressForm}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sectionTitle}>Información de Dirección</Text>
          
          <Text style={styles.label}>Calle y número</Text>
          <TextInput
            style={styles.input}
            value={pickupAddress.street}
            onChangeText={(text) => setPickupAddress(prev => ({ ...prev, street: text }))}
            placeholder="Ej: Calle 27 de Febrero #123"
          />

          <View style={styles.row}>
            <View style={styles.halfInput}>
              <Text style={styles.label}>Ciudad</Text>
              <TextInput
                style={styles.input}
                value={pickupAddress.city}
                onChangeText={(text) => setPickupAddress(prev => ({ ...prev, city: text }))}
                placeholder="Santo Domingo"
              />
            </View>
            <View style={styles.halfInput}>
              <Text style={styles.label}>Provincia</Text>
              <TextInput
                style={styles.input}
                value={pickupAddress.state}
                onChangeText={(text) => setPickupAddress(prev => ({ ...prev, state: text }))}
                placeholder="Distrito Nacional"
              />
            </View>
          </View>

          <Text style={styles.label}>Código postal (opcional)</Text>
          <TextInput
            style={styles.input}
            value={pickupAddress.zipCode}
            onChangeText={(text) => setPickupAddress(prev => ({ ...prev, zipCode: text }))}
            placeholder="10101"
            keyboardType="numeric"
          />

          <Text style={styles.label}>Referencias cercanas</Text>
          <TextInput
            style={styles.input}
            value={pickupAddress.landmarks}
            onChangeText={(text) => setPickupAddress(prev => ({ ...prev, landmarks: text }))}
            placeholder="Ej: Frente al Banco Popular, al lado de la farmacia"
          />

          <Text style={styles.label}>Instrucciones para el delivery</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={pickupAddress.instructions}
            onChangeText={(text) => setPickupAddress(prev => ({ ...prev, instructions: text }))}
            placeholder="Ej: Tocar el timbre, preguntar por el mostrador principal"
            multiline={true}
            numberOfLines={3}
          />
        </ScrollView>

        {/* Botón guardar */}
        <TouchableOpacity 
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]} 
          onPress={saveLocation}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark" size={20} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.saveButtonText}>Guardar Ubicación</Text>
            </>
          )}
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FF6B6B',
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  currentLocationButton: {
    padding: 5,
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  mapInstructions: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  instructionText: {
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
  },
  bottomContainer: {
    backgroundColor: '#fff',
    maxHeight: 400,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  addressForm: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  label: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 15,
    backgroundColor: '#fafafa',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfInput: {
    width: '48%',
  },
  saveButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FF6B6B',
    margin: 20,
    marginTop: 10,
    paddingVertical: 15,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  saveButtonDisabled: {
    backgroundColor: '#ccc',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default MerchantLocationScreen;