import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { getStatusBarHeight } from 'react-native-status-bar-height';
import { useTheme } from './context/ThemeContext';
import apiClient from '../api/apiClient';

const ChangePasswordScreen = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const statusBarHeight = getStatusBarHeight();
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const validateForm = () => {
    if (!currentPassword.trim()) {
      Alert.alert('Error', 'Ingresa tu contraseña actual');
      return false;
    }
    if (!newPassword.trim()) {
      Alert.alert('Error', 'Ingresa una nueva contraseña');
      return false;
    }
    if (newPassword.length < 6) {
      Alert.alert('Error', 'La nueva contraseña debe tener al menos 6 caracteres');
      return false;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Las contraseñas no coinciden');
      return false;
    }
    if (currentPassword === newPassword) {
      Alert.alert('Error', 'La nueva contraseña debe ser diferente a la actual');
      return false;
    }
    return true;
  };

  const handleChangePassword = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      await apiClient.put('/auth/change-password', {
        currentPassword,
        newPassword,
      });

      Alert.alert(
        'Éxito',
        'Tu contraseña ha sido cambiada correctamente',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      Alert.alert(
        'Error',
        error.response?.data?.message || 'No se pudo cambiar la contraseña'
      );
    } finally {
      setLoading(false);
    }
  };

  const passwordStrength = () => {
    if (!newPassword) return { strength: 0, text: '' };
    
    let strength = 0;
    let text = 'Muy débil';
    
    if (newPassword.length >= 6) strength += 1;
    if (newPassword.length >= 8) strength += 1;
    if (/[A-Z]/.test(newPassword)) strength += 1;
    if (/[0-9]/.test(newPassword)) strength += 1;
    if (/[^A-Za-z0-9]/.test(newPassword)) strength += 1;
    
    switch (strength) {
      case 0:
      case 1:
        text = 'Muy débil';
        break;
      case 2:
        text = 'Débil';
        break;
      case 3:
        text = 'Regular';
        break;
      case 4:
        text = 'Fuerte';
        break;
      case 5:
        text = 'Muy fuerte';
        break;
    }
    
    return { strength, text };
  };

  const { strength, text } = passwordStrength();

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: statusBarHeight + 10,
      paddingBottom: 20,
      backgroundColor: theme.colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    backButton: {
      marginRight: 15,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.colors.text,
    },
    content: {
      flex: 1,
      padding: 20,
    },
    description: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      marginBottom: 30,
      lineHeight: 22,
    },
    inputContainer: {
      marginBottom: 20,
    },
    label: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 8,
    },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 8,
      backgroundColor: theme.colors.surface,
    },
    input: {
      flex: 1,
      height: 50,
      paddingHorizontal: 15,
      fontSize: 16,
      color: theme.colors.text,
    },
    eyeButton: {
      padding: 15,
    },
    strengthContainer: {
      marginTop: 10,
    },
    strengthBar: {
      height: 4,
      backgroundColor: theme.colors.border,
      borderRadius: 2,
      marginBottom: 5,
    },
    strengthFill: {
      height: '100%',
      borderRadius: 2,
    },
    strengthText: {
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
    requirements: {
      marginTop: 10,
    },
    requirementItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 5,
    },
    requirementText: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginLeft: 8,
    },
    saveButton: {
      backgroundColor: theme.colors.primary,
      height: 50,
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 30,
    },
    saveButtonDisabled: {
      backgroundColor: theme.colors.disabled,
    },
    saveButtonText: {
      color: 'white',
      fontSize: 16,
      fontWeight: '600',
    },
  });

  const getStrengthColor = () => {
    const colors = [
      theme.colors.error,      // Muy débil
      theme.colors.error,      // Débil
      theme.colors.warning,    // Regular
      theme.colors.primary,    // Fuerte
      theme.colors.success,    // Muy fuerte
    ];
    return colors[strength] || theme.colors.border;
  };

  const requirements = [
    { text: 'Al menos 6 caracteres', met: newPassword.length >= 6 },
    { text: 'Al menos 8 caracteres', met: newPassword.length >= 8 },
    { text: 'Una letra mayúscula', met: /[A-Z]/.test(newPassword) },
    { text: 'Un número', met: /[0-9]/.test(newPassword) },
    { text: 'Un carácter especial', met: /[^A-Za-z0-9]/.test(newPassword) },
  ];

  const isFormValid = currentPassword && newPassword && confirmPassword && newPassword === confirmPassword && newPassword.length >= 6;

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="chevron-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cambiar Contraseña</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.description}>
          Para cambiar tu contraseña, ingresa tu contraseña actual y luego tu nueva contraseña.
        </Text>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Contraseña Actual</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="Ingresa tu contraseña actual"
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry={!showCurrentPassword}
              placeholderTextColor={theme.colors.textTertiary}
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowCurrentPassword(!showCurrentPassword)}
            >
              <Icon
                name={showCurrentPassword ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={theme.colors.textSecondary}
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Nueva Contraseña</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="Ingresa tu nueva contraseña"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry={!showNewPassword}
              placeholderTextColor={theme.colors.textTertiary}
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowNewPassword(!showNewPassword)}
            >
              <Icon
                name={showNewPassword ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={theme.colors.textSecondary}
              />
            </TouchableOpacity>
          </View>
          
          {newPassword ? (
            <View style={styles.strengthContainer}>
              <View style={styles.strengthBar}>
                <View 
                  style={[
                    styles.strengthFill,
                    { 
                      width: `${(strength / 5) * 100}%`,
                      backgroundColor: getStrengthColor()
                    }
                  ]}
                />
              </View>
              <Text style={styles.strengthText}>Fortaleza: {text}</Text>
              
              <View style={styles.requirements}>
                {requirements.map((req, index) => (
                  <View key={index} style={styles.requirementItem}>
                    <Icon
                      name={req.met ? 'checkmark-circle' : 'ellipse-outline'}
                      size={12}
                      color={req.met ? theme.colors.success : theme.colors.textTertiary}
                    />
                    <Text style={[
                      styles.requirementText,
                      { color: req.met ? theme.colors.success : theme.colors.textTertiary }
                    ]}>
                      {req.text}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Confirmar Nueva Contraseña</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="Confirma tu nueva contraseña"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirmPassword}
              placeholderTextColor={theme.colors.textTertiary}
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              <Icon
                name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={theme.colors.textSecondary}
              />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.saveButton,
            (!isFormValid || loading) && styles.saveButtonDisabled
          ]}
          onPress={handleChangePassword}
          disabled={!isFormValid || loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.saveButtonText}>Cambiar Contraseña</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

export default ChangePasswordScreen;