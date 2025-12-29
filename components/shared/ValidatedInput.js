import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';

const ValidatedInput = ({
  label,
  value,
  onChangeText,
  onBlur,
  error,
  touched,
  placeholder,
  secureTextEntry = false,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  multiline = false,
  numberOfLines = 1,
  maxLength,
  editable = true,
  leftIcon,
  rightIcon,
  showPasswordToggle = false,
  style,
  inputStyle,
  labelStyle,
  errorStyle,
  containerStyle,
  showCharCount = false,
  required = false,
  ...props
}) => {
  const { theme } = useTheme();
  const [showPassword, setShowPassword] = useState(!secureTextEntry);

  const hasError = touched && error;

  const styles = StyleSheet.create({
    container: {
      marginBottom: 16,
      ...containerStyle,
    },
    labelContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 6,
    },
    label: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.colors.text,
      ...labelStyle,
    },
    required: {
      color: '#FF6B6B',
      marginLeft: 2,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: hasError ? '#FF6B6B' : theme.colors.border,
      borderRadius: 8,
      backgroundColor: theme.colors.surface,
      paddingHorizontal: 12,
      minHeight: 48,
    },
    inputContainerFocused: {
      borderColor: theme.colors.primary,
      borderWidth: 2,
    },
    leftIconContainer: {
      marginRight: 10,
    },
    input: {
      flex: 1,
      fontSize: 16,
      color: theme.colors.text,
      paddingVertical: 12,
      textAlignVertical: multiline ? 'top' : 'center',
      ...inputStyle,
    },
    rightIconContainer: {
      marginLeft: 10,
    },
    errorContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 4,
    },
    errorIcon: {
      marginRight: 4,
    },
    errorText: {
      fontSize: 12,
      color: '#FF6B6B',
      flex: 1,
      ...errorStyle,
    },
    charCount: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      textAlign: 'right',
      marginTop: 4,
    },
    successIcon: {
      color: '#4CAF50',
    },
  });

  const [isFocused, setIsFocused] = useState(false);

  const handleFocus = () => {
    setIsFocused(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
    onBlur && onBlur();
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const getRightIcon = () => {
    if (showPasswordToggle) {
      return (
        <TouchableOpacity onPress={togglePasswordVisibility}>
          <Icon 
            name={showPassword ? 'eye-outline' : 'eye-off-outline'} 
            size={20} 
            color={theme.colors.textSecondary} 
          />
        </TouchableOpacity>
      );
    }

    if (touched && !error && value) {
      return (
        <Icon 
          name="checkmark-circle" 
          size={20} 
          style={styles.successIcon}
        />
      );
    }

    return rightIcon;
  };

  return (
    <View style={[styles.container, style]}>
      {label && (
        <View style={styles.labelContainer}>
          <Text style={styles.label}>{label}</Text>
          {required && <Text style={styles.required}>*</Text>}
        </View>
      )}
      
      <View style={[
        styles.inputContainer,
        isFocused && styles.inputContainerFocused,
        hasError && { borderColor: '#FF6B6B' }
      ]}>
        {leftIcon && (
          <View style={styles.leftIconContainer}>
            {leftIcon}
          </View>
        )}
        
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textTertiary}
          secureTextEntry={secureTextEntry && !showPassword}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          multiline={multiline}
          numberOfLines={numberOfLines}
          maxLength={maxLength}
          editable={editable}
          {...props}
        />
        
        {getRightIcon() && (
          <View style={styles.rightIconContainer}>
            {getRightIcon()}
          </View>
        )}
      </View>
      
      {hasError && (
        <View style={styles.errorContainer}>
          <Icon 
            name="alert-circle" 
            size={14} 
            color="#FF6B6B" 
            style={styles.errorIcon}
          />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      
      {showCharCount && maxLength && (
        <Text style={styles.charCount}>
          {value?.length || 0}/{maxLength}
        </Text>
      )}
    </View>
  );
};

export default ValidatedInput;