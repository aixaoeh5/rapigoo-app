import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

const EmptyState = ({
  title = 'No hay datos',
  message = 'No se encontraron elementos para mostrar',
  icon = 'folder-open-outline',
  iconSize = 64,
  iconColor = '#ccc',
  onAction,
  actionText = 'Agregar',
  actionIcon = 'add-outline',
  style,
  titleStyle,
  messageStyle,
  buttonStyle,
  buttonTextStyle,
  showAction = false
}) => {
  return (
    <View style={[styles.container, style]}>
      <Icon name={icon} size={iconSize} color={iconColor} />
      <Text style={[styles.title, titleStyle]}>{title}</Text>
      <Text style={[styles.message, messageStyle]}>{message}</Text>
      {showAction && onAction && (
        <TouchableOpacity 
          style={[styles.actionButton, buttonStyle]} 
          onPress={onAction}
        >
          <Icon name={actionIcon} size={16} color="#fff" style={styles.actionIcon} />
          <Text style={[styles.actionButtonText, buttonTextStyle]}>
            {actionText}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  actionIcon: {
    marginRight: 6,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default EmptyState;