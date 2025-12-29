import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '../api/apiClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AddressExtractionService from '../services/AddressExtractionService';

const ClientLocationSetupScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const mapRef = useRef(null);

  // Puede venir del registro o de la edición
  const { isEditing = false } = route.params || {};

  // Estado para el mapa y ubicación (basado en MerchantLocationScreen)
  const [region, setRegion] = useState(null);
  const [markerPosition, setMarkerPosition] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Estado para extracción automática
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState('');

  // Estado para la información de dirección
  const [addressDetails, setAddressDetails] = useState({
    street: '',
    city: 'Santo Domingo',
    state: 'Distrito Nacional',
    zipCode: '10101',
    landmarks: '',
    instructions: ''
  });

  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    initializeLocation();
  }, []);

  // Inicializar ubicación (basado en MerchantLocationScreen)
  const initializeLocation = async () => {
    try {
      setIsLoading(true);
      
      // Solicitar permisos de ubicación
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permisos requeridos', 
          'Necesitamos acceso a tu ubicación para ayudarte a establecer tu dirección de entrega.'
        );
        // Usar ubicación por defecto si no hay permisos
        setDefaultLocation();
        return;
      }

      // Intentar cargar la ubicación existente del usuario
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
      setDefaultLocation();
    } finally {
      setIsLoading(false);
    }
  };

  const setDefaultLocation = () => {
    // Ubicación por defecto para Santo Domingo
    const defaultRegion = {
      latitude: 18.4861,
      longitude: -69.9312,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };
    setRegion(defaultRegion);
    setMarkerPosition({
      latitude: 18.4861,
      longitude: -69.9312,
    });
  };

  const loadExistingLocation = async () => {
    try {
      if (isEditing) {
        // Cargar desde AsyncStorage para edición
        const userData = await AsyncStorage.getItem('userData');
        if (userData) {
          const user = JSON.parse(userData);
          if (user.deliveryAddress?.coordinates) {
            const [longitude, latitude] = user.deliveryAddress.coordinates;
            const existingRegion = {
              latitude,
              longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            };
            
            setRegion(existingRegion);
            setMarkerPosition({ latitude, longitude });
            
            // Cargar información de dirección existente
            setAddressDetails({
              street: user.deliveryAddress.street || '',
              city: user.deliveryAddress.city || 'Santo Domingo',
              state: user.deliveryAddress.state || 'Distrito Nacional',
              zipCode: user.deliveryAddress.zipCode || '10101',
              landmarks: user.deliveryAddress.landmarks || '',
              instructions: user.deliveryAddress.instructions || ''
            });
            
            console.log('📍 Ubicación existente cargada:', latitude, longitude);
          }
        }
      }
    } catch (error) {
      console.error('Error cargando ubicación existente:', error);
    }
  };

  const handleMapPress = (event) => {
    const { coordinate } = event.nativeEvent;
    setMarkerPosition(coordinate);
    console.log('📍 Nueva ubicación seleccionada:', coordinate);
    // Extraer dirección automáticamente cuando se mueve el marcador
    extractAddressFromCoordinates(coordinate.latitude, coordinate.longitude);
  };

  const handleMarkerDrag = (event) => {
    const { coordinate } = event.nativeEvent;
    setMarkerPosition(coordinate);
    console.log('📍 Marcador movido a:', coordinate);
    // También extraer dirección cuando se arrastra el marcador
    extractAddressFromCoordinates(coordinate.latitude, coordinate.longitude);
  };

  // Función para extraer dirección automáticamente con GPT
  const extractAddressFromCoordinates = async (latitude, longitude) => {
    setIsExtracting(true);
    setExtractionProgress('🔍 Analizando ubicación...');

    try {
      const extractedData = await AddressExtractionService.extractAddressFromCoordinates(latitude, longitude);
      
      if (extractedData) {
        setExtractionProgress('🎯 Dirección encontrada');
        
        // Auto-llenar los campos con la información extraída
        setAddressDetails({
          street: extractedData.street || '',
          city: extractedData.city || 'Santo Domingo',
          state: extractedData.state || 'Distrito Nacional',
          zipCode: extractedData.zipCode || '10101',
          landmarks: extractedData.landmarks || '',
          instructions: addressDetails.instructions // Mantener instrucciones existentes
        });

        // Actualizar texto de búsqueda también
        setSearchText(extractedData.fullAddress || extractedData.street);

        // Mostrar confirmación
        setTimeout(() => {
          setExtractionProgress('✅ Dirección completada automáticamente');
        }, 500);

        // Limpiar el estado después de 3 segundos
        setTimeout(() => {
          setExtractionProgress('');
        }, 3000);

      } else {
        setExtractionProgress('⚠️ No se pudo extraer la dirección');
        setTimeout(() => setExtractionProgress(''), 2000);
      }

    } catch (error) {
      console.error('Error extrayendo dirección:', error);
      setExtractionProgress('❌ Error extrayendo dirección');
      setTimeout(() => setExtractionProgress(''), 2000);
    } finally {
      setIsExtracting(false);
    }
  };

  const searchLocation = async () => {
    if (!searchText.trim()) {
      Alert.alert('Error', 'Ingresa una dirección para buscar');
      return;
    }

    try {
      // Aquí podrías integrar con Google Places API o similar
      Alert.alert('Búsqueda', 'Mueve el marcador manualmente a tu ubicación exacta');
    } catch (error) {
      Alert.alert('Error', 'No se pudo buscar la ubicación');
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
      
      // Extraer dirección automáticamente
      extractAddressFromCoordinates(location.coords.latitude, location.coords.longitude);
    } catch (error) {
      console.error('Error obteniendo ubicación actual:', error);
      Alert.alert('Error', 'No se pudo obtener tu ubicación actual');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!markerPosition) {
      Alert.alert('Error', 'Por favor, selecciona una ubicación en el mapa');
      return;
    }

    if (!addressDetails.street.trim()) {
      Alert.alert('Campo requerido', 'Por favor ingresa tu dirección detallada');
      return;
    }

    setIsSubmitting(true);

    try {
      const locationData = {
        coordinates: [markerPosition.longitude, markerPosition.latitude],
        street: addressDetails.street,
        city: addressDetails.city,
        state: addressDetails.state,
        zipCode: addressDetails.zipCode,
        landmarks: addressDetails.landmarks,
        instructions: addressDetails.instructions
      };

      console.log('📡 Enviando ubicación del cliente:', JSON.stringify(locationData, null, 2));

      console.log('🔄 Guardando dirección usando endpoint update-profile');
      
      const response = await apiClient.put('/auth/update-profile', {
        deliveryAddress: locationData
      });

      console.log('📍 Respuesta del servidor:', JSON.stringify(response.data, null, 2));
      console.log('📍 Status de respuesta:', response.status);

      // Verificar que la respuesta indica éxito
      const saveSuccessful = response.data.success || 
                           response.status === 200 || 
                           (response.data.user && response.data.user.deliveryAddress);

      if (saveSuccessful) {
        console.log('✅ Ubicación guardada exitosamente en servidor');
        
        // Actualizar datos en AsyncStorage con la respuesta del servidor
        const userData = await AsyncStorage.getItem('userData');
        if (userData) {
          const user = JSON.parse(userData);
          // Usar los datos de la respuesta del servidor si están disponibles
          user.deliveryAddress = response.data.user?.deliveryAddress || locationData;
          await AsyncStorage.setItem('userData', JSON.stringify(user));
          console.log('✅ AsyncStorage actualizado con nueva ubicación');
        } else {
          console.log('⚠️ No se encontró userData en AsyncStorage');
        }

        if (isEditing) {
          Alert.alert(
            '✅ Ubicación Actualizada', 
            'Tu dirección de entrega ha sido actualizada exitosamente.',
            [
              {
                text: 'OK',
                onPress: () => navigation.goBack()
              }
            ]
          );
        } else {
          Alert.alert(
            '✅ Ubicación Guardada', 
            'Tu dirección de entrega ha sido configurada. ¡Ya puedes usar la app!',
            [
              {
                text: 'Continuar',
                onPress: () => {
                  navigation.reset({
                    index: 0,
                    routes: [{ name: 'Home' }],
                  });
                }
              }
            ]
          );
        }
      } else {
        console.log('❌ Respuesta del servidor no indica éxito');
        console.log('📍 Datos de respuesta:', response.data);
        throw new Error(response.data.message || 'El servidor no confirma que se guardó la ubicación');
      }
    } catch (error) {
      console.error('❌ Error al guardar ubicación:', error);
      console.error('❌ Detalles del error:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      
      let errorMessage = 'Error al guardar la ubicación';
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert('Error al guardar', errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading screen similar to MerchantLocationScreen
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B6B" />
        <Text style={styles.loadingText}>Cargando mapa...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={26} color="black" />
        </TouchableOpacity>
        <Text style={styles.title}>
          {isEditing ? 'Editar Mi Ubicación' : 'Tu Ubicación de Entrega'}
        </Text>
      </View>

      <ScrollView style={styles.content}>
        <Text style={styles.subtitle}>
          {isEditing 
            ? 'Actualiza tu ubicación para recibir tus pedidos'
            : 'Selecciona dónde quieres recibir tus pedidos. Esta será tu dirección principal de entrega.'
          }
        </Text>

        {/* Búsqueda */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar dirección..."
            value={searchText}
            onChangeText={setSearchText}
          />
          <TouchableOpacity style={styles.searchButton} onPress={searchLocation}>
            <Ionicons name="search" size={20} color="#666" />
          </TouchableOpacity>
        </View>

        {/* Botones de acción */}
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity style={styles.gpsButton} onPress={centerOnCurrentLocation}>
            <Ionicons name="location" size={20} color="#4CAF50" />
            <Text style={styles.gpsText}>Usar GPS</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.extractButton, isExtracting && styles.extractButtonDisabled]} 
            onPress={() => markerPosition && extractAddressFromCoordinates(markerPosition.latitude, markerPosition.longitude)}
            disabled={isExtracting || !markerPosition}
          >
            <Ionicons name="sparkles" size={20} color="#fff" />
            <Text style={styles.extractText}>
              {isExtracting ? 'Extrayendo...' : 'Auto-rellenar'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Indicador de progreso */}
        {extractionProgress ? (
          <View style={styles.progressContainer}>
            <Text style={styles.progressText}>{extractionProgress}</Text>
          </View>
        ) : null}

        {/* Mapa */}
        <View style={styles.mapContainer}>
          {region && (
            <MapView
              ref={mapRef}
              style={styles.map}
              initialRegion={region}
              onPress={handleMapPress}
              showsUserLocation={true}
              showsMyLocationButton={false}
            >
              {markerPosition && (
                <Marker
                  coordinate={markerPosition}
                  title="Mi Ubicación"
                  description="Aquí recibiré mis pedidos"
                  pinColor="#FF6B6B"
                  draggable={true}
                  onDragEnd={handleMarkerDrag}
                />
              )}
            </MapView>
          )}
          <View style={styles.markerInstructions}>
            <Text style={styles.instructionsText}>
              📍 Toca en el mapa para mover el marcador a tu ubicación exacta
            </Text>
          </View>
        </View>

        {/* Formulario de dirección */}
        <View style={styles.formContainer}>
          <Text style={styles.sectionTitle}>Detalles de la Dirección</Text>
          
          <Text style={styles.label}>Dirección exacta *</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej: Calle Mercedes #123, Apto 2B"
            value={addressDetails.street}
            onChangeText={(text) => setAddressDetails({...addressDetails, street: text})}
          />

          <View style={styles.row}>
            <View style={styles.halfWidth}>
              <Text style={styles.label}>Ciudad</Text>
              <TextInput
                style={styles.input}
                placeholder="Ciudad"
                value={addressDetails.city}
                onChangeText={(text) => setAddressDetails({...addressDetails, city: text})}
              />
            </View>
            <View style={styles.halfWidth}>
              <Text style={styles.label}>Código Postal</Text>
              <TextInput
                style={styles.input}
                placeholder="10101"
                value={addressDetails.zipCode}
                onChangeText={(text) => setAddressDetails({...addressDetails, zipCode: text})}
                keyboardType="numeric"
              />
            </View>
          </View>

          <Text style={styles.label}>Referencias/Puntos de referencia</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej: Edificio azul, frente al Banco Popular"
            value={addressDetails.landmarks}
            onChangeText={(text) => setAddressDetails({...addressDetails, landmarks: text})}
          />

          <Text style={styles.label}>Instrucciones para el delivery</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Ej: Tocar el timbre, preguntar en portería, apartamento segundo piso..."
            value={addressDetails.instructions}
            onChangeText={(text) => setAddressDetails({...addressDetails, instructions: text})}
            multiline
            numberOfLines={3}
          />
        </View>

        <TouchableOpacity 
          style={[styles.submitButton, isSubmitting && styles.buttonDisabled]} 
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          <Text style={styles.submitButtonText}>
            {isSubmitting 
              ? 'Guardando...' 
              : isEditing 
                ? 'Actualizar Ubicación' 
                : 'Guardar y Continuar'
            }
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    padding: 10,
    marginRight: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
  },
  content: {
    flex: 1,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    margin: 20,
    lineHeight: 22,
  },
  searchContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    marginRight: 10,
  },
  searchButton: {
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  gpsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F5E8',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4CAF50',
    flex: 0.48,
  },
  gpsText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '500',
  },
  extractButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF6B6B',
    padding: 12,
    borderRadius: 8,
    flex: 0.48,
  },
  extractButtonDisabled: {
    backgroundColor: '#FFB3B3',
  },
  extractText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  progressContainer: {
    backgroundColor: '#f8f9fa',
    paddingVertical: 8,
    paddingHorizontal: 15,
    marginHorizontal: 20,
    marginBottom: 15,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FF6B6B',
  },
  progressText: {
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
    fontWeight: '500',
  },
  mapContainer: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  map: {
    width: '100%',
    height: 250,
  },
  markerInstructions: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: 10,
  },
  instructionsText: {
    color: 'white',
    fontSize: 12,
    textAlign: 'center',
  },
  formContainer: {
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 5,
    marginLeft: 5,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    marginBottom: 15,
    fontSize: 16,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfWidth: {
    width: '48%',
  },
  submitButton: {
    backgroundColor: '#E60023',
    paddingVertical: 15,
    borderRadius: 8,
    margin: 20,
    alignItems: 'center',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

export default ClientLocationSetupScreen;