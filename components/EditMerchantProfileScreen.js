import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import PhoneInput from 'react-native-phone-number-input';

const EditMerchantProfileScreen = ({ navigation }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [originalEmail, setOriginalEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [avatar, setAvatar] = useState('https://cdn-icons-png.flaticon.com/512/149/149071.png');
  const [address, setAddress] = useState('');
  const [openingHours, setOpeningHours] = useState('');
  const [closingHours, setClosingHours] = useState('');
  const [socials, setSocials] = useState('');
  const phoneInputRef = useRef(null);

  useEffect(() => {
    const fetchUser = async () => {
      const token = await AsyncStorage.getItem('token');
      if (!token) return;

      try {
        const res = await fetch('http://10.0.2.2:5000/api/auth/user', {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = await res.json();

        if (res.ok) {
          setName(data.name);
          setEmail(data.email);
          setOriginalEmail(data.email);
          setPhone(data.phone || '');
          setAvatar(data.avatar || '');
          const businessAddress = data.business?.address;
          if (typeof businessAddress === 'string') {
            setAddress(businessAddress);
          } else if (businessAddress?.street) {
            setAddress(`${businessAddress.street}, ${businessAddress.city}, ${businessAddress.state}`);
          } else {
            setAddress('');
          }
          setOpeningHours(data.business?.schedule?.opening || '');
          setClosingHours(data.business?.schedule?.closing || '');
          setSocials(data.business?.socials || '');
        } else {
          Alert.alert(data.message || 'Error al obtener los datos');
        }
      } catch (error) {
        console.error('❌ Error al cargar:', error);
        Alert.alert('Error de conexión');
      }
    };

    const requestPermission = async () => {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso denegado', 'Necesitamos acceso a tu galería para elegir una foto');
      }
    };

    fetchUser();
    requestPermission();
  }, []);

  const handleSave = async () => {
    const token = await AsyncStorage.getItem('token');
    if (!token) return;

    const formattedPhone = phoneInputRef.current?.getNumberAfterPossiblyEliminatingZero()?.formattedNumber || phone;

    if (email !== originalEmail) {
      navigation.navigate('VerifyIdentity', {
        newEmail: email,
        name,
        phone: formattedPhone,
        avatar,
      });
      return;
    }

    const payload = {
      name,
      email,
      phone: formattedPhone,
      avatar,
      business: {
        address,
        schedule: {
          opening: openingHours,
          closing: closingHours,
        },
        socials,
      },
    };

    console.log('📦 Payload enviado al backend:', payload);

    try {
      const res = await fetch('http://10.0.2.2:5000/api/merchant/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      console.log('✅ Respuesta del backend:', data);

      if (res.ok) {
        Alert.alert('✅ Cambios guardados');
        navigation.goBack();
      } else {
        Alert.alert(data.message || 'Error al guardar');
      }
    } catch (error) {
      console.error('❌ Error en la petición:', error);
      Alert.alert('Error de conexión');
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });

      if (!result.canceled) {
        setAvatar(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error al seleccionar imagen:', error);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 80 }}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="chevron-back" size={26} color="black" />
        </TouchableOpacity>

        <Text style={styles.title}>Editar Perfil</Text>

        <View style={styles.avatarContainer}>
          <Image source={{ uri: avatar }} style={styles.avatar} />
          <TouchableOpacity style={styles.editIcon} onPress={pickImage}>
            <Icon name="pencil" size={14} color="white" />
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Nombre</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} />

        <Text style={styles.label}>Correo electrónico</Text>
        <TextInput style={styles.input} value={email} onChangeText={setEmail} />

        <Text style={styles.label}>Teléfono</Text>
        <PhoneInput
          ref={phoneInputRef}
          defaultValue={phone}
          value={phone}
          defaultCode=""
          layout="first"
          onChangeFormattedText={setPhone}
          withDarkTheme={false}
          withShadow={false}
          containerStyle={styles.phoneContainer}
          textContainerStyle={styles.phoneTextContainer}
          textInputStyle={styles.phoneInputText}
          codeTextStyle={styles.phoneCodeText}
          countryPickerProps={{ withAlphaFilter: true }}
        />

        <Text style={styles.label}>Dirección</Text>
        <TextInput style={styles.input} value={address} onChangeText={setAddress} />

        <Text style={styles.label}>Horario de apertura</Text>
        <TextInput style={styles.input} value={openingHours} onChangeText={setOpeningHours} />

        <Text style={styles.label}>Horario de cierre</Text>
        <TextInput style={styles.input} value={closingHours} onChangeText={setClosingHours} />

        <Text style={styles.label}>Link de redes sociales (Instagram, WhatsApp, etc.)</Text>
        <TextInput
          style={styles.input}
          value={socials}
          onChangeText={setSocials}
          keyboardType="url"
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="https://..."
        />

        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveText}>Guardar Cambios</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingTop: 60,
  },
  backButton: {
    position: 'absolute',
    top: 2,
    left: 1,
    zIndex: 10,
    padding: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    alignSelf: 'center',
    marginBottom: 50,
    top: 8,
  },
  avatarContainer: {
    alignSelf: 'center',
    marginBottom: 20,
    position: 'relative',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  editIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: 'black',
    padding: 6,
    borderRadius: 10,
  },
  label: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    padding: 10,
    marginBottom: 15,
    fontSize: 16,
  },
  phoneContainer: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    marginBottom: 15,
    width: '100%',
    height: 50,
  },
  phoneTextContainer: {
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
    backgroundColor: '#fff',
    paddingVertical: 0,
  },
  phoneInputText: {
    fontSize: 16,
    paddingVertical: 0,
  },
  phoneCodeText: {
    fontSize: 16,
  },
  saveButton: {
    backgroundColor: '#000',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  saveText: {
    color: 'white',
    fontWeight: 'bold',
  },
});

export default EditMerchantProfileScreen;
