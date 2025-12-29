// components/shared/SafeAreaView.js
import React from 'react';
import { View, StatusBar, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Componente wrapper que maneja el SafeArea correctamente
 * Evita que la barra de estado se superponga con el contenido
 */
const SafeAreaView = ({ 
  children, 
  style = {}, 
  statusBarStyle = "dark-content",
  backgroundColor = "#fff",
  edges = ['top']
}) => {
  const insets = useSafeAreaInsets();
  
  return (
    <View style={[
      { 
        flex: 1,
        backgroundColor,
        // Solo aplicar padding-top si 'top' está en edges
        paddingTop: edges.includes('top') ? 
          (Platform.OS === 'android' ? Math.max(insets.top, 20) : insets.top) : 0,
        paddingBottom: edges.includes('bottom') ? insets.bottom : 0,
        paddingLeft: edges.includes('left') ? insets.left : 0,
        paddingRight: edges.includes('right') ? insets.right : 0,
      },
      style
    ]}>
      <StatusBar 
        barStyle={statusBarStyle} 
        backgroundColor="transparent" 
        translucent={true}
      />
      {children}
    </View>
  );
};

export default SafeAreaView;