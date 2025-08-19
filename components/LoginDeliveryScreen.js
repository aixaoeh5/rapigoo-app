import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Platform, Alert, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import { getStatusBarHeight } from 'react-native-status-bar-height';
import { useTheme } from './context/ThemeContext';
import apiClient from '../api/apiClient';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LoginDeliveryScreen = () => {
    const navigation = useNavigation();
    const { theme } = useTheme();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const statusBarHeight = getStatusBarHeight();

    const handleLogin = async () => {
        if (!email.trim() || !password.trim()) {
            Alert.alert('Error', 'Por favor, completa todos los campos');
            return;
        }

        setLoading(true);
        try {
            console.log('🚚 Iniciando sesión delivery con:', email);
            
            const response = await apiClient.post('/auth/login', {
                email: email.trim(),
                password: password
            });

            console.log('🚚 Login response:', response.data);

            if (response.data.token && response.data.user) {
                const userData = response.data.user;
                const token = response.data.token;
                
                // Verificar que el usuario sea delivery
                if (userData.role !== 'delivery') {
                    Alert.alert('Error', 'Esta cuenta no es de delivery. Use el login correcto.');
                    return;
                }

                // Verificar estado de aprobación del delivery
                if (userData.deliveryStatus !== 'aprobado') {
                    if (userData.deliveryStatus === 'pendiente') {
                        Alert.alert('Cuenta Pendiente', 'Tu cuenta de delivery está pendiente de aprobación. Te contactaremos pronto.');
                        return;
                    } else if (userData.deliveryStatus === 'suspendido') {
                        Alert.alert('Cuenta Suspendida', 'Tu cuenta de delivery está suspendida. Contacta con soporte.');
                        return;
                    } else if (userData.deliveryStatus === 'rechazado') {
                        Alert.alert('Cuenta Rechazada', 'Tu solicitud de delivery fue rechazada. Contacta con soporte.');
                        return;
                    } else {
                        Alert.alert('Error', 'Tu cuenta de delivery no está activa. Contacta con soporte.');
                        return;
                    }
                }

                // Guardar datos del usuario con el token
                const userDataWithToken = {
                    ...userData,
                    token: token
                };
                
                await AsyncStorage.setItem('token', token);
                await AsyncStorage.setItem('userData', JSON.stringify(userDataWithToken));

                console.log('🚚 Login exitoso, navegando a HomeDelivery');
                
                // Resetear navegación para evitar volver al login
                navigation.reset({
                    index: 0,
                    routes: [{ name: 'HomeDelivery' }],
                });
            } else {
                Alert.alert('Error', response.data.message || 'Error al iniciar sesión');
            }
        } catch (error) {
            console.error('❌ Error en login delivery:', error);
            console.error('❌ Error response:', error.response?.data);
            
            let errorMessage = 'Error al iniciar sesión';
            
            if (error.response?.status === 401) {
                errorMessage = 'Email o contraseña incorrectos';
            } else if (error.response?.status === 404) {
                errorMessage = 'Usuario no encontrado';
            } else if (error.response?.data?.message) {
                errorMessage = error.response.data.message;
            } else if (error.message?.includes('Network Error')) {
                errorMessage = 'Error de conexión. Verifica tu internet';
            }
            
            Alert.alert('Error', errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const styles = StyleSheet.create({
        container: {
            flex: 1,
            padding: 20,
            backgroundColor: theme.colors.background,
            justifyContent: 'center',
        },
        backButton: {
            position: 'absolute',
            top: statusBarHeight + 10,
            left: 10,
            zIndex: 10,
        },
        title: {
            fontSize: 24,
            fontWeight: 'bold',
            marginBottom: 30,
            textAlign: 'center',
            color: theme.colors.text,
        },
        input: {
            borderWidth: 1,
            borderColor: theme.colors.border,
            borderRadius: 8,
            padding: 15,
            fontSize: 16,
            backgroundColor: theme.colors.surface,
            color: theme.colors.text,
            marginBottom: 15,
        },
        button: {
            backgroundColor: theme.colors.primary,
            padding: 15,
            borderRadius: 8,
            alignItems: 'center',
            marginTop: 10,
        },
        buttonText: {
            color: 'white',
            fontSize: 16,
            fontWeight: 'bold',
        },
        buttonDisabled: {
            opacity: 0.6,
        },
        forgotPasswordButton: {
            alignItems: 'center',
            marginTop: 20,
        },
        forgotPasswordText: {
            color: theme.colors.primary,
            fontSize: 16,
        },
        createAccountButton: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 20,
        },
        createAccountText: {
            color: theme.colors.text,
            fontSize: 16,
        },
        socialButtonsContainer: {
            flexDirection: 'row',
            justifyContent: 'center',
            marginTop: 30,
            gap: 20,
        },
        socialButton: {
            padding: 10,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: theme.colors.border,
        },
    });

    return (
        <View style={[styles.container, { paddingTop: statusBarHeight }]}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                <Icon name="chevron-back" size={26} color={theme.colors.text} />
            </TouchableOpacity>
            <Text style={styles.title}>Bienvenido de nuevo.</Text>

            <TextInput
                style={styles.input}
                placeholder="Email"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                placeholderTextColor={theme.colors.textTertiary}
            />
            <TextInput
                style={styles.input}
                placeholder="Contraseña"
                secureTextEntry={true}
                value={password}
                onChangeText={setPassword}
                placeholderTextColor={theme.colors.textTertiary}
            />

            <TouchableOpacity style={styles.forgotPasswordButton}>
                <Text style={styles.forgotPasswordText}>¿Olvidaste la contraseña?</Text>
            </TouchableOpacity>
            <TouchableOpacity 
                style={[styles.button, loading && styles.buttonDisabled]} 
                onPress={handleLogin}
                disabled={loading}
            >
                {loading ? (
                    <ActivityIndicator size="small" color="white" />
                ) : (
                    <Text style={styles.buttonText}>Iniciar Sesión</Text>
                )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.createAccountButton} onPress={() => navigation.navigate('Register')}>
                <Text style={styles.createAccountText}>¿No tienes una cuenta?</Text>
                <Text style={[styles.createAccountText, { fontWeight: 'bold' }]}> Crear cuenta</Text>
            </TouchableOpacity>

            <View style={styles.socialButtonsContainer}>
                <TouchableOpacity style={styles.socialButton}>
                    <Icon name="logo-google" size={30} color="gray" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.socialButton}>
                    <Icon name="logo-facebook" size={30} color="gray" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.socialButton}>
                    <Icon name="logo-apple" size={30} color="gray" />
                </TouchableOpacity>
            </View>
        </View>
    );
};

export default LoginDeliveryScreen;

