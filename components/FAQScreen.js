import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { getStatusBarHeight } from 'react-native-status-bar-height';
import { useTheme } from './context/ThemeContext';

const FAQScreen = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const statusBarHeight = getStatusBarHeight();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedItems, setExpandedItems] = useState(new Set());

  const faqs = [
    {
      id: 1,
      category: 'Cuenta',
      question: '¿Cómo puedo crear una cuenta?',
      answer: 'Para crear una cuenta, abre la app y selecciona "Registrarse". Completa tus datos personales y verifica tu email. El proceso es rápido y seguro.'
    },
    {
      id: 2,
      category: 'Cuenta',
      question: '¿Olvidé mi contraseña, qué hago?',
      answer: 'En la pantalla de login, toca "¿Olvidaste tu contraseña?". Ingresa tu email y recibirás un código para restablecer tu contraseña.'
    },
    {
      id: 3,
      category: 'Pedidos',
      question: '¿Cómo hago un pedido?',
      answer: 'Busca el comerciante o servicio que deseas, selecciona los productos, agrégalos al carrito y procede al checkout. Puedes pagar con diferentes métodos.'
    },
    {
      id: 4,
      category: 'Pedidos',
      question: '¿Puedo cancelar mi pedido?',
      answer: 'Puedes cancelar tu pedido dentro de los primeros 5 minutos después de realizarlo, siempre que el comerciante no haya comenzado a prepararlo.'
    },
    {
      id: 5,
      category: 'Pagos',
      question: '¿Qué métodos de pago aceptan?',
      answer: 'Aceptamos tarjetas de crédito y débito, PayPal, y pago en efectivo para entregas. Todos los pagos son seguros y encriptados.'
    },
    {
      id: 6,
      category: 'Pagos',
      question: '¿Es seguro pagar en la app?',
      answer: 'Sí, todos los pagos están protegidos con encriptación de nivel bancario. No almacenamos información sensible de tarjetas en nuestros servidores.'
    },
    {
      id: 7,
      category: 'Entrega',
      question: '¿Cuánto tiempo tarda la entrega?',
      answer: 'El tiempo de entrega varía según el comerciante y tu ubicación, pero generalmente es entre 30-60 minutos. Puedes ver el tiempo estimado antes de confirmar tu pedido.'
    },
    {
      id: 8,
      category: 'Entrega',
      question: '¿Puedo rastrear mi pedido?',
      answer: 'Sí, puedes rastrear tu pedido en tiempo real desde la sección "Mis Pedidos". Recibirás notificaciones sobre el estado de tu pedido.'
    },
    {
      id: 9,
      category: 'Comerciantes',
      question: '¿Cómo puedo ser comerciante en Rapigoo?',
      answer: 'Selecciona "Comerciante" al registrarte, completa el formulario de negocio y espera la aprobación. Nuestro equipo revisará tu solicitud en 24-48 horas.'
    },
    {
      id: 10,
      category: 'Comerciantes',
      question: '¿Qué comisión cobra Rapigoo?',
      answer: 'Cobramos una comisión competitiva del 15% por cada venta. No hay costos ocultos ni tarifas de membresía.'
    },
    {
      id: 11,
      category: 'Técnico',
      question: 'La app no funciona correctamente',
      answer: 'Intenta cerrar y abrir la app nuevamente. Si el problema persiste, verifica tu conexión a internet o contacta a soporte técnico.'
    },
    {
      id: 12,
      category: 'Técnico',
      question: '¿En qué dispositivos funciona Rapigoo?',
      answer: 'Rapigoo funciona en iOS 12+ y Android 8.0+. También puedes usar nuestra versión web desde cualquier navegador moderno.'
    }
  ];

  const categories = [...new Set(faqs.map(faq => faq.category))];

  const toggleExpanded = (id) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  const filteredFAQs = faqs.filter(faq =>
    faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
    faq.answer.toLowerCase().includes(searchQuery.toLowerCase()) ||
    faq.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
    searchContainer: {
      paddingHorizontal: 20,
      paddingVertical: 15,
      backgroundColor: theme.colors.card,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: 8,
      paddingHorizontal: 15,
      height: 45,
    },
    searchIcon: {
      marginRight: 10,
    },
    searchInput: {
      flex: 1,
      fontSize: 16,
      color: theme.colors.text,
    },
    content: {
      flex: 1,
    },
    categorySection: {
      marginTop: 10,
    },
    categoryHeader: {
      backgroundColor: theme.colors.surface,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    categoryTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.primary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    faqItem: {
      backgroundColor: theme.colors.card,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    faqHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 15,
    },
    questionContainer: {
      flex: 1,
      marginRight: 10,
    },
    question: {
      fontSize: 16,
      fontWeight: '500',
      color: theme.colors.text,
      lineHeight: 22,
    },
    expandIcon: {
      padding: 5,
    },
    answerContainer: {
      paddingHorizontal: 20,
      paddingBottom: 20,
      paddingTop: 0,
    },
    answer: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      lineHeight: 20,
    },
    noResults: {
      padding: 40,
      alignItems: 'center',
    },
    noResultsIcon: {
      marginBottom: 15,
    },
    noResultsText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.textSecondary,
      marginBottom: 8,
    },
    noResultsSubtext: {
      fontSize: 14,
      color: theme.colors.textTertiary,
      textAlign: 'center',
    },
    helpFooter: {
      backgroundColor: theme.colors.card,
      padding: 20,
      alignItems: 'center',
      marginTop: 20,
    },
    helpText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginBottom: 15,
    },
    contactButton: {
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 6,
    },
    contactButtonText: {
      color: 'white',
      fontSize: 14,
      fontWeight: '600',
    },
  });

  const renderFAQsByCategory = () => {
    return categories.map(category => {
      const categoryFAQs = filteredFAQs.filter(faq => faq.category === category);
      
      if (categoryFAQs.length === 0) return null;

      return (
        <View key={category} style={styles.categorySection}>
          <View style={styles.categoryHeader}>
            <Text style={styles.categoryTitle}>{category}</Text>
          </View>
          {categoryFAQs.map(faq => (
            <View key={faq.id} style={styles.faqItem}>
              <TouchableOpacity
                style={styles.faqHeader}
                onPress={() => toggleExpanded(faq.id)}
              >
                <View style={styles.questionContainer}>
                  <Text style={styles.question}>{faq.question}</Text>
                </View>
                <View style={styles.expandIcon}>
                  <Icon
                    name={expandedItems.has(faq.id) ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={theme.colors.textSecondary}
                  />
                </View>
              </TouchableOpacity>
              {expandedItems.has(faq.id) && (
                <View style={styles.answerContainer}>
                  <Text style={styles.answer}>{faq.answer}</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      );
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="chevron-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Preguntas Frecuentes</Text>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Icon 
            name="search-outline" 
            size={20} 
            color={theme.colors.textSecondary}
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar preguntas..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={theme.colors.textTertiary}
          />
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {filteredFAQs.length > 0 ? (
          renderFAQsByCategory()
        ) : (
          <View style={styles.noResults}>
            <Icon 
              name="search-outline" 
              size={48} 
              color={theme.colors.textTertiary}
              style={styles.noResultsIcon}
            />
            <Text style={styles.noResultsText}>No se encontraron resultados</Text>
            <Text style={styles.noResultsSubtext}>
              Intenta con términos diferentes o contacta a soporte
            </Text>
          </View>
        )}

        <View style={styles.helpFooter}>
          <Text style={styles.helpText}>
            ¿No encontraste lo que buscabas?{'\n'}
            Nuestro equipo de soporte está aquí para ayudarte.
          </Text>
          <TouchableOpacity 
            style={styles.contactButton}
            onPress={() => navigation.navigate('ContactSupport')}
          >
            <Text style={styles.contactButtonText}>Contactar Soporte</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

export default FAQScreen;