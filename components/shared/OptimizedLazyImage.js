import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Image,
  ActivityIndicator,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import ImageCacheManager from './ImageCacheManager';

const { height: screenHeight } = Dimensions.get('window');

const OptimizedLazyImage = ({ 
  source, 
  style, 
  resizeMode = 'cover', 
  placeholder = null,
  fadeDuration = 300,
  showLoader = true,
  threshold = 100,
  enableCache = true,
  lowQualityPlaceholder = null,
  onLoad,
  onError,
  onViewportEnter,
  onViewportExit,
  ...props 
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [imageUri, setImageUri] = useState(null);
  const [inViewport, setInViewport] = useState(false);
  const [shouldLoad, setShouldLoad] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const viewRef = useRef(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!loading && !error && shouldLoad && imageUri) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: fadeDuration,
        useNativeDriver: true,
      }).start();
    }
  }, [loading, error, shouldLoad, imageUri, fadeAnim, fadeDuration]);

  const handleLayout = async () => {
    if (!mounted.current || !viewRef.current) return;

    try {
      viewRef.current.measureInWindow((x, y, width, height) => {
        if (!mounted.current) return;
        
        const isVisible = y + height >= -threshold && y <= screenHeight + threshold;
        
        if (isVisible && !inViewport) {
          setInViewport(true);
          setShouldLoad(true);
          onViewportEnter && onViewportEnter();
          loadImage();
        } else if (!isVisible && inViewport) {
          setInViewport(false);
          onViewportExit && onViewportExit();
        }
      });
    } catch (error) {
      console.warn('Error measuring image position:', error);
    }
  };

  const loadImage = async () => {
    if (!source || (!source.uri && !source) || loading || imageUri) return;

    setLoading(true);
    setError(false);

    try {
      let finalUri = typeof source === 'string' ? source : source.uri;

      // Try to get cached image first
      if (enableCache && finalUri && finalUri.startsWith('http')) {
        const cachedUri = await ImageCacheManager.getCachedImagePath(finalUri);
        if (cachedUri && mounted.current) {
          finalUri = cachedUri;
        }
      }

      if (mounted.current) {
        setImageUri(finalUri);
      }
    } catch (cacheError) {
      console.warn('Error loading cached image:', cacheError);
      // Fallback to original source
      if (mounted.current) {
        const fallbackUri = typeof source === 'string' ? source : source.uri;
        setImageUri(fallbackUri);
      }
    }
  };

  useEffect(() => {
    if (shouldLoad && !imageUri && !loading) {
      loadImage();
    }
  }, [shouldLoad, imageUri, loading]);

  useEffect(() => {
    // Check initial visibility
    const timer = setTimeout(() => {
      if (mounted.current) {
        handleLayout();
      }
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const handleImageLoad = () => {
    if (!mounted.current) return;
    setLoading(false);
    setError(false);
    onLoad && onLoad();
  };

  const handleImageError = (errorEvent) => {
    if (!mounted.current) return;
    setLoading(false);
    setError(true);
    onError && onError(errorEvent);
  };

  const handleImageLoadStart = () => {
    if (!mounted.current) return;
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

  const renderLowQualityPlaceholder = () => {
    if (!lowQualityPlaceholder || !shouldLoad) return null;

    return (
      <View style={[StyleSheet.absoluteFill, { opacity: loading ? 1 : 0 }]}>
        <Image
          source={lowQualityPlaceholder}
          style={[style, { position: 'absolute' }]}
          resizeMode={resizeMode}
          blurRadius={2}
        />
      </View>
    );
  };

  // Si no hay source válido, mostrar placeholder
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

      {/* Low quality placeholder */}
      {renderLowQualityPlaceholder()}
      
      {/* Imagen principal */}
      {shouldLoad && imageUri && (
        <Animated.View 
          style={[
            style,
            { opacity: loading || error ? 0 : fadeAnim }
          ]}
        >
          <Image
            source={{ uri: imageUri }}
            style={[style, { position: 'absolute' }]}
            resizeMode={resizeMode}
            onLoadStart={handleImageLoadStart}
            onLoad={handleImageLoad}
            onError={handleImageError}
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

export default OptimizedLazyImage;