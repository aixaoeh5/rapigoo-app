import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Image,
  ActivityIndicator,
  StyleSheet,
  Animated
} from 'react-native';

const LazyImage = ({ 
  source, 
  style, 
  resizeMode = 'cover', 
  placeholder = null,
  fadeDuration = 300,
  showLoader = true,
  onLoad,
  onError,
  ...props 
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!loading && !error) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: fadeDuration,
        useNativeDriver: true,
      }).start();
    }
  }, [loading, error, fadeAnim, fadeDuration]);

  const handleLoad = () => {
    setLoading(false);
    setError(false);
    onLoad && onLoad();
  };

  const handleError = (errorEvent) => {
    setLoading(false);
    setError(true);
    onError && onError(errorEvent);
  };

  const renderPlaceholder = () => {
    if (placeholder) {
      return placeholder;
    }

    return (
      <View style={[styles.placeholder, style]}>
        {showLoader && loading && (
          <ActivityIndicator size="small" color="#ccc" />
        )}
        {error && (
          <View style={styles.errorContainer}>
            <View style={styles.errorIcon} />
          </View>
        )}
      </View>
    );
  };

  // Si no hay source, mostrar placeholder
  if (!source || (!source.uri && !source)) {
    return renderPlaceholder();
  }

  return (
    <View style={style}>
      {/* Placeholder mientras carga o en caso de error */}
      {(loading || error) && (
        <View style={[StyleSheet.absoluteFill]}>
          {renderPlaceholder()}
        </View>
      )}
      
      {/* Imagen principal */}
      <Animated.View 
        style={[
          style,
          { opacity: loading || error ? 0 : fadeAnim }
        ]}
      >
        <Image
          source={source}
          style={[style, { position: 'absolute' }]}
          resizeMode={resizeMode}
          onLoad={handleLoad}
          onError={handleError}
          {...props}
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorIcon: {
    width: 24,
    height: 24,
    backgroundColor: '#ddd',
    borderRadius: 12,
  },
});

export default LazyImage;