import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';

const EditProfileScreen = ({ navigation }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [originalEmail, setOriginalEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [originalPhone, setOriginalPhone] = useState('');
  const [avatar, setAvatar] = useState('https://cdn-icons-png.flaticon.com/512/149/149071.png');

  useEffect(() => {
    const fetchUser = async () => {
      const token = await AsyncStorage.getItem('token');
      if (!token) return;

      try {
        const res = await fetch('http://10.0.2.2:5000/api/auth/user', {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        });

        const text = await res.text();
        console.log('📩 Respuesta del servidor (/user):', text);

        try {
          const data = JSON.parse(text);
          if (res.ok) {
            setName(data.name);
            setEmail(data.email);
            setOriginalEmail(data.email);
            setPhone(data.phone || '');
            setOriginalPhone(data.phone || '');
            setAvatar(data.avatar || avatar);
          } else {
            Alert.alert(data.message || 'Error al obtener los datos');
          }
        } catch (parseError) {
          console.error('❌ Error al parsear JSON:', parseError);
          Alert.alert('Respuesta inesperada del servidor');
        }
      } catch (err) {
        console.error('❌ Error en la petición:', err);
        Alert.alert('Error de conexión');
      }
    };

    const requestPermission = async () => {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permiso denegado',
          'Necesitamos acceso a tu galería para elegir una foto'
        );
      }
    };

    fetchUser();
    requestPermission();
  }, []);

  const handleSave = async () => {
    const token = await AsyncStorage.getItem('token');
    if (!token) return;

    if (email !== originalEmail) {
      navigation.navigate('VerifyIdentity', {
        newEmail: email,
        name,
        phone,
        avatar,
      });
      return;
    }

if (phone !== originalPhone) {
  navigation.navigate('VerifyPhoneScreen', {
    phone,
    name,
    email,
    avatar,
  });
  return;
}


    try {
      const response = await fetch('http://10.0.2.2:5000/api/auth/update-profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, email, phone, avatar }),
      });

      const text = await response.text();
      console.log('📤 Respuesta del servidor (/update-profile):', text);

      try {
        const data = JSON.parse(text);
        if (response.ok) {
          Alert.alert('✅ Cambios guardados');
          navigation.goBack();
        } else {
          Alert.alert(data.message || 'Error al guardar');
        }
      } catch (error) {
        console.error('❌ Error al parsear JSON:', error);
        Alert.alert('Respuesta inesperada del servidor');
      }
    } catch (err) {
      console.error('❌ Error en la petición:', err);
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
    <View style={styles.container}>
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
      <TextInput
        style={styles.input}
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
      />

      <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveText}>Guardar Cambios</Text>
      </TouchableOpacity>
    </View>
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
    top: 58,
    left: 20,
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

export default EditProfileScreen;
