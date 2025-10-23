import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
  ScrollView,
  Dimensions
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import MapView, { Marker } from 'react-native-maps';
import Icon from 'react-native-vector-icons/Ionicons';
import apiClient from '../api/apiClient';

const { width, height } = Dimensions.get('window');

const BusinessFormStep3Screen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const mapRef = useRef(null);

  const { businessName, rnc, category, address, openingHours, closingHours, description } = route.params;

  const [location, setLocation] = useState({
    latitude: 18.4861,
    longitude: -69.9312,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });
  
  const [markerPosition, setMarkerPosition] = useState({
    latitude: 18.4861,
    longitude: -69.9312,
  });

  const [addressDetails, setAddressDetails] = useState({
    street: '',
    city: 'Santo Domingo',
    state: 'Distrito Nacional',
    zipCode: '',
    landmarks: '',
    instructions: ''
  });

  const [searchText, setSearchText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Centrar el mapa en Santo Domingo por defecto
    if (mapRef.current) {
      mapRef.current.animateToRegion(location, 1000);
    }
  }, []);

  const handleMapPress = (event) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    setMarkerPosition({ latitude, longitude });
  };

  const searchLocation = async () => {
    if (!searchText.trim()) {
      Alert.alert('Error', 'Ingresa una dirección para buscar');
      return;
    }

    try {
      // Aquí podrías integrar con Google Places API o similar
      // Por ahora, simulamos una búsqueda simple
      Alert.alert('Búsqueda', 'Mueve el marcador manualmente a la ubicación exacta de tu negocio');
    } catch (error) {
      Alert.alert('Error', 'No se pudo buscar la ubicación');
    }
  };

  const getCurrentLocation = () => {
    Alert.alert('GPS', 'Función de GPS no implementada aún. Mueve el marcador manualmente.');
  };

  const handleSubmit = async () => {
    if (!addressDetails.street.trim()) {
      Alert.alert('Campo requerido', 'Por favor ingresa la dirección detallada');
      return;
    }

    setIsSubmitting(true);

    try {
      const businessData = {
        businessName,
        rnc,
        category,
        address,
        openHour: openingHours,
        closeHour: closingHours,
        description,
        // Datos de ubicación
        location: {
          type: 'Point',
          coordinates: [markerPosition.longitude, markerPosition.latitude]
        },
        pickupAddress: {
          street: addressDetails.street,
          city: addressDetails.city,
          state: addressDetails.state,
          zipCode: addressDetails.zipCode,
          landmarks: addressDetails.landmarks,
          instructions: addressDetails.instructions
        }
      };

      const response = await apiClient.post('/merchant/profile', businessData);

      Alert.alert(
        '✅ Perfil Completo', 
        'Tu negocio ha sido registrado con ubicación. Está pendiente de aprobación.',
        [
          {
            text: 'OK',
            onPress: () => {
              navigation.reset({
                index: 0,
                routes: [{ name: 'MerchantPendingApproval' }],
              });
            }
          }
        ]
      );
    } catch (error) {
      console.error('❌ Error al guardar negocio con ubicación:', error.response?.data?.message || error.message);
      Alert.alert('Error', error.response?.data?.message || 'No se pudo completar el registro');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="chevron-back" size={26} color="black" />
        </TouchableOpacity>
        <Text style={styles.title}>Ubicación del Negocio (3 de 3)</Text>
      </View>

      <ScrollView style={styles.content}>
        <Text style={styles.subtitle}>
          Marca la ubicación exacta de tu negocio para que los deliveries puedan encontrarte fácilmente
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
            <Icon name="search" size={20} color="#666" />
          </TouchableOpacity>
        </View>

        {/* Botón GPS */}
        <TouchableOpacity style={styles.gpsButton} onPress={getCurrentLocation}>
          <Icon name="location" size={20} color="#4CAF50" />
          <Text style={styles.gpsText}>Usar mi ubicación actual</Text>
        </TouchableOpacity>

        {/* Mapa */}
        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={location}
            onPress={handleMapPress}
            showsUserLocation={true}
            showsMyLocationButton={false}
          >
            <Marker
              coordinate={markerPosition}
              title="Tu Negocio"
              description="Ubicación de pickup para deliveries"
              pinColor="#E60023"
            />
          </MapView>
          <View style={styles.markerInstructions}>
            <Text style={styles.instructionsText}>
              📍 Toca en el mapa para mover el marcador a la ubicación exacta
            </Text>
          </View>
        </View>

        {/* Formulario de dirección */}
        <View style={styles.formContainer}>
          <Text style={styles.sectionTitle}>Detalles de la Dirección</Text>
          
          <Text style={styles.label}>Dirección exacta *</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej: Calle Mercedes #123, Zona Colonial"
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
            placeholder="Ej: Frente al Banco Popular, al lado de la farmacia"
            value={addressDetails.landmarks}
            onChangeText={(text) => setAddressDetails({...addressDetails, landmarks: text})}
          />

          <Text style={styles.label}>Instrucciones para el delivery</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Ej: Tocar el timbre, preguntar por el administrador..."
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
            {isSubmitting ? 'Enviando...' : 'Completar Registro'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
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
  gpsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 12,
    backgroundColor: '#E8F5E8',
    borderRadius: 8,
  },
  gpsText: {
    marginLeft: 8,
    color: '#4CAF50',
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

export default BusinessFormStep3Screen;