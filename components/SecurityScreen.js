import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Switch,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { getStatusBarHeight } from 'react-native-status-bar-height';
import { useTheme } from './context/ThemeContext';

const SecurityScreen = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const statusBarHeight = getStatusBarHeight();
  
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [fingerprintEnabled, setFingerprintEnabled] = useState(false);
  const [loginNotifications, setLoginNotifications] = useState(true);

  const securityOptions = [
    {
      title: 'Cambiar Contraseña',
      subtitle: 'Actualiza tu contraseña de acceso',
      icon: 'key-outline',
      onPress: () => navigation.navigate('ChangePassword'),
      type: 'navigation'
    },
    {
      title: 'Autenticación de Dos Factores',
      subtitle: twoFactorEnabled ? 'Activada' : 'Desactivada',
      icon: 'shield-checkmark-outline',
      onPress: () => navigation.navigate('TwoFactor'),
      type: 'navigation',
      rightComponent: (
        <Switch
          value={twoFactorEnabled}
          onValueChange={setTwoFactorEnabled}
          trackColor={{ false: theme.colors.disabled, true: theme.colors.primary }}
          thumbColor={twoFactorEnabled ? theme.colors.surface : theme.colors.background}
        />
      )
    },
    {
      title: 'Huella Digital / Face ID',
      subtitle: fingerprintEnabled ? 'Activado' : 'Desactivado',
      icon: 'finger-print-outline',
      onPress: () => setFingerprintEnabled(!fingerprintEnabled),
      type: 'toggle',
      rightComponent: (
        <Switch
          value={fingerprintEnabled}
          onValueChange={setFingerprintEnabled}
          trackColor={{ false: theme.colors.disabled, true: theme.colors.primary }}
          thumbColor={fingerprintEnabled ? theme.colors.surface : theme.colors.background}
        />
      )
    },
    {
      title: 'Sesiones Activas',
      subtitle: 'Ver y administrar tus sesiones',
      icon: 'phone-portrait-outline',
      onPress: () => navigation.navigate('ActiveSessions'),
      type: 'navigation'
    },
    {
      title: 'Notificaciones de Acceso',
      subtitle: 'Recibir alertas de nuevos accesos',
      icon: 'notifications-outline',
      onPress: () => setLoginNotifications(!loginNotifications),
      type: 'toggle',
      rightComponent: (
        <Switch
          value={loginNotifications}
          onValueChange={setLoginNotifications}
          trackColor={{ false: theme.colors.disabled, true: theme.colors.primary }}
          thumbColor={loginNotifications ? theme.colors.surface : theme.colors.background}
        />
      )
    }
  ];

  const handleDeleteAccount = () => {
    Alert.alert(
      'Eliminar Cuenta',
      '¿Estás seguro de que quieres eliminar tu cuenta? Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Eliminar', 
          style: 'destructive',
          onPress: () => {
            // TODO: Implementar eliminación de cuenta
            Alert.alert('Función no implementada', 'Esta funcionalidad estará disponible pronto.');
          }
        }
      ]
    );
  };

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
    },
    section: {
      backgroundColor: theme.colors.card,
      marginTop: 20,
      paddingVertical: 10,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.textSecondary,
      paddingHorizontal: 20,
      paddingBottom: 10,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    optionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 15,
      paddingHorizontal: 20,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    lastItem: {
      borderBottomWidth: 0,
    },
    iconContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.colors.surface,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 15,
    },
    optionContent: {
      flex: 1,
    },
    optionTitle: {
      fontSize: 16,
      fontWeight: '500',
      color: theme.colors.text,
      marginBottom: 4,
    },
    optionSubtitle: {
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
    chevron: {
      marginLeft: 10,
    },
    dangerZone: {
      backgroundColor: theme.colors.card,
      marginTop: 40,
      paddingVertical: 10,
    },
    dangerButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 15,
      paddingHorizontal: 20,
    },
    dangerText: {
      fontSize: 16,
      fontWeight: '500',
      color: theme.colors.error,
      marginLeft: 15,
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="chevron-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Seguridad</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Configuración de Seguridad</Text>
          {securityOptions.map((option, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.optionItem,
                index === securityOptions.length - 1 && styles.lastItem
              ]}
              onPress={option.onPress}
              disabled={option.type === 'toggle'}
            >
              <View style={styles.iconContainer}>
                <Icon name={option.icon} size={20} color={theme.colors.primary} />
              </View>
              <View style={styles.optionContent}>
                <Text style={styles.optionTitle}>{option.title}</Text>
                <Text style={styles.optionSubtitle}>{option.subtitle}</Text>
              </View>
              {option.rightComponent || (
                option.type === 'navigation' && (
                  <Icon 
                    name="chevron-forward" 
                    size={16} 
                    color={theme.colors.textTertiary}
                    style={styles.chevron}
                  />
                )
              )}
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.dangerZone}>
          <Text style={styles.sectionTitle}>Zona de Peligro</Text>
          <TouchableOpacity style={styles.dangerButton} onPress={handleDeleteAccount}>
            <Icon name="trash-outline" size={20} color={theme.colors.error} />
            <Text style={styles.dangerText}>Eliminar Cuenta</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

export default SecurityScreen;