import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

const ErrorState = ({
  title = 'Error',
  message = 'Algo salió mal',
  onRetry,
  retryText = 'Reintentar',
  icon = 'alert-circle-outline',
  iconSize = 64,
  iconColor = '#FF6B6B',
  style,
  titleStyle,
  messageStyle,
  buttonStyle,
  buttonTextStyle,
  showRetry = true
}) => {
  return (
    <View style={[styles.container, style]}>
      <Icon name={icon} size={iconSize} color={iconColor} />
      <Text style={[styles.title, titleStyle]}>{title}</Text>
      <Text style={[styles.message, messageStyle]}>{message}</Text>
      {showRetry && onRetry && (
        <TouchableOpacity 
          style={[styles.retryButton, buttonStyle]} 
          onPress={onRetry}
        >
          <Icon name="refresh-outline" size={16} color="#fff" style={styles.retryIcon} />
          <Text style={[styles.retryButtonText, buttonTextStyle]}>
            {retryText}
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
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  retryIcon: {
    marginRight: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ErrorState;