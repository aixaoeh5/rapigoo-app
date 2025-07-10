import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { getStatusBarHeight } from 'react-native-status-bar-height';

const LoginComercianteScreen = () => {
    const navigation = useNavigation();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const statusBarHeight = getStatusBarHeight();

    const handleLogin = () => {
        console.log('Iniciando sesión con:', email, password); 
        navigation.navigate('HomeComerciante'); 
    };

    return (
        <View style={[styles.container, { paddingTop: statusBarHeight }]}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                <Icon name="chevron-left" size={20} color="black" />
            </TouchableOpacity>
            <Text style={styles.title}>Bienvenido de nuevo.</Text>

            <TextInput
                style={styles.input}
                placeholder="Email"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
            />
            <TextInput
                style={styles.input}
                placeholder="Contraseña"
                secureTextEntry={true}
                value={password}
                onChangeText={setPassword}
            />

            <TouchableOpacity style={styles.forgotPasswordButton}>
                <Text style={styles.forgotPasswordText}>¿Olvidaste la contraseña?</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={handleLogin}>
                <Text style={styles.buttonText}>Iniciar Sesión</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.createAccountButton} onPress={() => navigation.navigate('Register')}>
                <Text style={styles.createAccountText}>¿No tienes una cuenta?</Text>
                <Text style={[styles.createAccountText, { fontWeight: 'bold' }]}> Crear cuenta</Text>
            </TouchableOpacity>

            <View style={styles.socialButtonsContainer}>
                <TouchableOpacity style={styles.socialButton}>
                    <Icon name="google" size={30} color="gray" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.socialButton}>
                    <Icon name="facebook" size={30} color="gray" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.socialButton}>
                    <Icon name="apple" size={30} color="gray" />
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        backgroundColor: 'white',
    },
    backButton: {
        marginBottom: 20,
        top: 50,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 30,
        top: 80,
        left: 10,
    },
    input: {
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 50,
        padding: 15,
        marginBottom: 30,
        top: 100,
    },
    button: {
        backgroundColor: 'black',
        padding: 15,
        borderRadius: 50,
        alignItems: 'center',
        top: 130,
    },
    buttonText: {
        color: 'white',
        fontWeight: 'bold',
    },
    forgotPasswordButton: {
        alignSelf: 'flex-end',
        marginBottom: 20,
        top: 85,
        right: 15,
    },
    forgotPasswordText: {
        color: 'gray',
    },
    createAccountButton: {
        flexDirection: 'row',
        top: 150,
        justifyContent: 'center',
    },
    createAccountText: {
        color: 'gray',
        top: 20,
    },
    socialButtonsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 230,
    },
    socialButton: {
        marginHorizontal: 10,
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 10,
        padding: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default LoginComercianteScreen;
