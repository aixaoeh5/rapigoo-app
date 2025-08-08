import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { getStatusBarHeight } from 'react-native-status-bar-height';
import { useTheme } from './context/ThemeContext';

const HelpScreen = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const statusBarHeight = getStatusBarHeight();

  const helpOptions = [
    {
      title: 'Preguntas Frecuentes',
      subtitle: 'Respuestas a las dudas más comunes',
      icon: 'help-circle-outline',
      onPress: () => navigation.navigate('FAQ'),
    },
    {
      title: 'Contactar Soporte',
      subtitle: 'Envía un mensaje a nuestro equipo',
      icon: 'mail-outline',
      onPress: () => navigation.navigate('ContactSupport'),
    },
    {
      title: 'Tutoriales',
      subtitle: 'Aprende a usar la aplicación',
      icon: 'play-circle-outline',
      onPress: () => navigation.navigate('Tutorials'),
    },
    {
      title: 'Términos de Servicio',
      subtitle: 'Lee nuestros términos y condiciones',
      icon: 'document-text-outline',
      onPress: () => openExternalLink('https://rapigoo.com/terms'),
    },
    {
      title: 'Política de Privacidad',
      subtitle: 'Cómo protegemos tu información',
      icon: 'shield-outline',
      onPress: () => openExternalLink('https://rapigoo.com/privacy'),
    },
  ];

  const quickActions = [
    {
      title: 'WhatsApp',
      subtitle: 'Chatea con nosotros',
      icon: 'logo-whatsapp',
      color: '#25D366',
      onPress: () => openWhatsApp(),
    },
    {
      title: 'Email',
      subtitle: 'support@rapigoo.com',
      icon: 'mail',
      color: theme.colors.primary,
      onPress: () => openEmail(),
    },
    {
      title: 'Teléfono',
      subtitle: '+1 (829) 123-4567',
      icon: 'call',
      color: theme.colors.info,
      onPress: () => openPhone(),
    },
  ];

  const openExternalLink = (url) => {
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'No se pudo abrir el enlace');
    });
  };

  const openWhatsApp = () => {
    const phoneNumber = '18291234567';
    const message = 'Hola, necesito ayuda con la app Rapigoo';
    const url = `whatsapp://send?phone=${phoneNumber}&text=${encodeURIComponent(message)}`;
    
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'WhatsApp no está instalado en tu dispositivo');
    });
  };

  const openEmail = () => {
    const email = 'support@rapigoo.com';
    const subject = 'Soporte - App Rapigoo';
    const url = `mailto:${email}?subject=${encodeURIComponent(subject)}`;
    
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'No se pudo abrir la aplicación de correo');
    });
  };

  const openPhone = () => {
    const phoneNumber = 'tel:+18291234567';
    
    Linking.openURL(phoneNumber).catch(() => {
      Alert.alert('Error', 'No se pudo abrir la aplicación de teléfono');
    });
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
    welcomeSection: {
      backgroundColor: theme.colors.card,
      padding: 20,
      margin: 20,
      borderRadius: 12,
      alignItems: 'center',
    },
    welcomeIcon: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: theme.colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 15,
    },
    welcomeTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: 8,
    },
    welcomeText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },
    section: {
      backgroundColor: theme.colors.card,
      marginTop: 10,
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
    coloredIconContainer: {
      backgroundColor: 'transparent',
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
    quickActionsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      backgroundColor: theme.colors.card,
      marginTop: 10,
      paddingVertical: 20,
    },
    quickActionItem: {
      alignItems: 'center',
      flex: 1,
    },
    quickActionIcon: {
      width: 50,
      height: 50,
      borderRadius: 25,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 8,
    },
    quickActionTitle: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 2,
    },
    quickActionSubtitle: {
      fontSize: 10,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    appInfo: {
      backgroundColor: theme.colors.card,
      marginTop: 10,
      padding: 20,
      alignItems: 'center',
    },
    appVersion: {
      fontSize: 12,
      color: theme.colors.textTertiary,
      marginBottom: 5,
    },
    appBuild: {
      fontSize: 10,
      color: theme.colors.textTertiary,
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
        <Text style={styles.headerTitle}>Ayuda</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.welcomeSection}>
          <View style={styles.welcomeIcon}>
            <Icon name="help-circle" size={30} color="white" />
          </View>
          <Text style={styles.welcomeTitle}>¿Necesitas ayuda?</Text>
          <Text style={styles.welcomeText}>
            Estamos aquí para ayudarte. Encuentra respuestas rápidas o contacta a nuestro equipo de soporte.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Centro de Ayuda</Text>
          {helpOptions.map((option, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.optionItem,
                index === helpOptions.length - 1 && styles.lastItem
              ]}
              onPress={option.onPress}
            >
              <View style={styles.iconContainer}>
                <Icon name={option.icon} size={20} color={theme.colors.primary} />
              </View>
              <View style={styles.optionContent}>
                <Text style={styles.optionTitle}>{option.title}</Text>
                <Text style={styles.optionSubtitle}>{option.subtitle}</Text>
              </View>
              <Icon 
                name="chevron-forward" 
                size={16} 
                color={theme.colors.textTertiary}
                style={styles.chevron}
              />
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contacto Rápido</Text>
          <View style={styles.quickActionsContainer}>
            {quickActions.map((action, index) => (
              <TouchableOpacity
                key={index}
                style={styles.quickActionItem}
                onPress={action.onPress}
              >
                <View style={[
                  styles.quickActionIcon,
                  { backgroundColor: `${action.color}20` }
                ]}>
                  <Icon name={action.icon} size={24} color={action.color} />
                </View>
                <Text style={styles.quickActionTitle}>{action.title}</Text>
                <Text style={styles.quickActionSubtitle}>{action.subtitle}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.appInfo}>
          <Text style={styles.appVersion}>Rapigoo v1.0.0</Text>
          <Text style={styles.appBuild}>Build 2024.001</Text>
        </View>
      </ScrollView>
    </View>
  );
};

export default HelpScreen;