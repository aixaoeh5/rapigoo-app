/**
 * Script de debugging específico para la navegación a DeliveryHistory
 * Para usar con React Native debugger
 */

// Agregar este código al inicio de App.js o como un componente de debug

export const NavigationDebugger = {
  logNavigation: (from, to, params = null) => {
    console.log('🚀 NAVIGATION DEBUG:', {
      from,
      to,
      params,
      paramsType: typeof params,
      paramsKeys: params ? Object.keys(params) : 'No params',
      timestamp: new Date().toISOString()
    });

    // Verificar si hay parámetros problemáticos
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value === undefined) {
          console.warn(`⚠️ UNDEFINED PARAM: ${key} is undefined`);
        }
        if (value === null) {
          console.warn(`⚠️ NULL PARAM: ${key} is null`);
        }
        if (typeof value === 'object' && value !== null) {
          console.log(`🔍 OBJECT PARAM ${key}:`, {
            type: typeof value,
            keys: Object.keys(value),
            hasId: value._id || 'No _id'
          });
        }
      });
    }
  },

  wrapNavigate: (navigation) => {
    const originalNavigate = navigation.navigate;
    navigation.navigate = function(routeName, params) {
      NavigationDebugger.logNavigation('Unknown', routeName, params);
      return originalNavigate.call(this, routeName, params);
    };
    return navigation;
  }
};

// Función para interceptar específicamente la navegación a DeliveryHistory
export const interceptDeliveryHistoryNavigation = (navigation) => {
  const originalNavigate = navigation.navigate;
  navigation.navigate = function(routeName, params) {
    if (routeName === 'DeliveryHistory') {
      console.log('🎯 INTERCEPTED DELIVERY HISTORY NAVIGATION:', {
        routeName,
        params,
        paramsType: typeof params,
        timestamp: new Date().toISOString()
      });

      // Verificar y limpiar parámetros problemáticos
      if (params) {
        const cleanParams = {};
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            cleanParams[key] = value;
          } else {
            console.warn(`🧹 Removing ${key} (value: ${value}) from navigation params`);
          }
        });
        
        if (Object.keys(cleanParams).length > 0) {
          console.log('🧹 Using cleaned params:', cleanParams);
          return originalNavigate.call(this, routeName, cleanParams);
        } else {
          console.log('🧹 Using no params (all were undefined/null)');
          return originalNavigate.call(this, routeName);
        }
      }
    }
    return originalNavigate.call(this, routeName, params);
  };
  return navigation;
};