import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Image,
  ActivityIndicator,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';

const { height: screenHeight } = Dimensions.get('window');

const LazyImageWithIntersection = ({ 
  source, 
  style, 
  resizeMode = 'cover', 
  placeholder = null,
  fadeDuration = 300,
  showLoader = true,
  threshold = 100, // Pixels from screen to start loading
  onLoad,
  onError,
  onViewportEnter,
  onViewportExit,
  ...props 
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [inViewport, setInViewport] = useState(false);
  const [shouldLoad, setShouldLoad] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const viewRef = useRef(null);

  useEffect(() => {
    if (!loading && !error && shouldLoad) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: fadeDuration,
        useNativeDriver: true,
      }).start();
    }
  }, [loading, error, shouldLoad, fadeAnim, fadeDuration]);

  const handleLayout = () => {
    if (viewRef.current) {
      viewRef.current.measureInWindow((x, y, width, height) => {
        const isVisible = y + height >= -threshold && y <= screenHeight + threshold;
        
        if (isVisible && !inViewport) {
          setInViewport(true);
          setShouldLoad(true);
          onViewportEnter && onViewportEnter();
        } else if (!isVisible && inViewport) {
          setInViewport(false);
          onViewportExit && onViewportExit();
        }
      });
    }
  };

  useEffect(() => {
    // Check initial visibility
    const timer = setTimeout(handleLayout, 100);
    return () => clearTimeout(timer);
  }, []);

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

  const handleLoadStart = () => {
    setLoading(true);
    setError(false);
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
        {!shouldLoad && !loading && !error && (
          <View style={styles.notLoadedContainer}>
            <View style={styles.notLoadedIcon} />
          </View>
        )}
      </View>
    );
  };

  // Si no hay source, mostrar placeholder
  if (!source || (!source.uri && !source)) {
    return (
      <View 
        ref={viewRef}
        style={style}
        onLayout={handleLayout}
      >
        {renderPlaceholder()}
      </View>
    );
  }

  return (
    <View 
      ref={viewRef}
      style={style}
      onLayout={handleLayout}
    >
      {/* Placeholder mientras carga o en caso de error */}
      {(!shouldLoad || loading || error) && (
        <View style={[StyleSheet.absoluteFill]}>
          {renderPlaceholder()}
        </View>
      )}
      
      {/* Imagen principal - solo se renderiza si debe cargar */}
      {shouldLoad && (
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
            onLoadStart={handleLoadStart}
            onLoad={handleLoad}
            onError={handleError}
            {...props}
          />
        </Animated.View>
      )}
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
  notLoadedContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  notLoadedIcon: {
    width: 20,
    height: 20,
    backgroundColor: '#e0e0e0',
    borderRadius: 10,
  },
});

export default LazyImageWithIntersection;