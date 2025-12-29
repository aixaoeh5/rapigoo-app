import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LogBox, StatusBar, Platform, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemeProvider } from './components/context/ThemeContext';
import { CartProvider } from './components/context/CartContext';
import ErrorInterceptor from './utils/ErrorInterceptor';

// Suprimir warnings específicos de Expo Go para notificaciones
LogBox.ignoreLogs([
  'expo-notifications: Android Push notifications',
  'remote notifications',
  'removed from Expo Go',
  'functionality provided by expo-notifications was removed',
  'Use a development build instead of Expo Go',
  'expo-notifications` functionality is not fully supported in Expo Go',
]);

import WelcomeScreen from './components/WelcomeScreen';
import UserTypeScreen from './components/UserTypeScreen';
import LoginScreen from './components/LoginScreen';
import RegisterScreen from './components/RegisterScreen';
import LoginComercianteScreen from './components/LoginComercianteScreen';
import LoginDeliveryScreen from './components/LoginDeliveryScreen';
import HomeScreen from './components/HomeScreen';
import HomeComercianteScreen from './components/HomeComercianteScreen';
import NotFoundScreen from './components/NotFoundScreen';
import EmptyCartScreen from './components/EmptyCartScreen';
import NoResultsScreen from './components/NoResultsScreen';
import HistorialPedidosScreen from './components/HistorialPedidosScreen';
import ServicesScreen from './components/ServicesScreen';
import AddServiceScreen from './components/AddServiceScreen';
import DeliveryMapScreen from './components/DeliveryMapScreen';
import SettingsScreen from './components/SettingsScreen';
import ProfileScreen from './components/ProfileScreen';
import StartupScreen from './components/StartupScreen';
import EditProfileScreen from './components/EditProfileScreen';
import ForgotPasswordScreen from './components/ForgotPasswordScreen';
import ResetPasswordScreen from './components/ResetPasswordScreen';
import VerifyIdentityScreen from './components/VerifyIdentityScreen';
import VerifyResetCodeScreen from './components/VerifyResetCodeScreen';
import VerifyRegisterCodeScreen from './components/VerifyRegisterCodeScreen';
import VerifyEmailChangeScreen from './components/VerifyEmailChangeScreen';
import RegisterMerchantScreen from './components/RegisterMerchantScreen';
import VerifyMerchantCodeScreen from './components/VerifyMerchantCodeScreen';
import BusinessFormStep1Screen from './components/BusinessFormStep1Screen';
import BusinessFormStep2Screen from './components/BusinessFormStep2Screen';
import BusinessFormStep3Screen from './components/BusinessFormStep3Screen';
import MerchantPendingApprovalScreen from './components/MerchantPendingApprovalScreen';
import ProfileMerchantScreen from './components/ProfileMerchantScreen';
import EditMerchantProfileScreen from './components/EditMerchantProfileScreen';
import CategoryScreen from './components/CategoryScreen';
import MerchantProfileScreen from './components/MerchantProfileScreen';
import SecurityScreen from './components/SecurityScreen';
import ChangePasswordScreen from './components/ChangePasswordScreen';
import HelpScreen from './components/HelpScreen';
import FAQScreen from './components/FAQScreen';
import PaymentMethodsScreen from './components/PaymentMethodsScreen';
import CartScreen from './components/CartScreen';
import CheckoutScreen from './components/CheckoutScreen';
import OrderConfirmationScreen from './components/OrderConfirmationScreen';
import OrderManagementScreen from './components/OrderManagementScreen';
import FavoritesScreen from './components/FavoritesScreen';
import DeliveryNavigationScreen from './components/DeliveryNavigationScreen';
import DeliveryNavigationScreenSimple from './components/DeliveryNavigationScreenSimple';
import OrderTrackingScreen from './components/OrderTrackingScreen';
import HomeDeliveryScreen from './components/HomeDeliveryScreen';
import SimpleHomeDeliveryScreen from './components/SimpleHomeDeliveryScreen';
import DeliveryHistoryScreen from './components/DeliveryHistoryScreen';
import MerchantLocationScreen from './components/MerchantLocationScreen';
import ClientLocationSetupScreen from './components/ClientLocationSetupScreen';
import TestMapScreen from './components/TestMapScreen';
import OrderStatusNotifier from './components/shared/OrderStatusNotifier';

const Stack = createNativeStackNavigator();

// Inicializar el interceptor de errores una sola vez
let interceptorInitialized = false;
if (!interceptorInitialized) {
  ErrorInterceptor.init();
  interceptorInitialized = true;
}

// Componente wrapper para manejar la SafeArea
function SafeAreaWrapper({ children }) {
  const insets = useSafeAreaInsets();
  
  return (
    <View style={{ 
      flex: 1, 
      paddingTop: Platform.OS === 'android' ? insets.top : 0,
      backgroundColor: '#fff'
    }}>
      <StatusBar 
        barStyle="dark-content" 
        backgroundColor="transparent" 
        translucent={true}
      />
      {children}
    </View>
  );
}

export default function App() {
  console.log('🚀 App iniciando - Error interceptor activado');
  
  return (
    <SafeAreaProvider>
      <SafeAreaWrapper>
        <ThemeProvider>
          <CartProvider>
            <NavigationContainer>
              <Stack.Navigator initialRouteName="Startup" screenOptions={{ headerShown: false }}>
                <Stack.Screen name="Startup" component={StartupScreen} />
                <Stack.Screen name="Welcome" component={WelcomeScreen} />
                <Stack.Screen name="UserType" component={UserTypeScreen} />
                <Stack.Screen name="Login" component={LoginScreen} />
                <Stack.Screen name="Register" component={RegisterScreen} />
                <Stack.Screen name="LoginComerciante" component={LoginComercianteScreen} />
                <Stack.Screen name="LoginDelivery" component={LoginDeliveryScreen} />
                <Stack.Screen name="Home" component={HomeScreen} />
                <Stack.Screen name="HomeComerciante" component={HomeComercianteScreen} />
                <Stack.Screen name="NotFound" component={NotFoundScreen} />
                <Stack.Screen name="EmptyCart" component={EmptyCartScreen} />
                <Stack.Screen name="NoResults" component={NoResultsScreen} />
                <Stack.Screen name="HistorialPedidos" component={HistorialPedidosScreen} />
                <Stack.Screen name="Services" component={ServicesScreen} />
                <Stack.Screen name="AddService" component={AddServiceScreen} />
                <Stack.Screen name="DeliveryMap" component={DeliveryMapScreen} />
                <Stack.Screen name="Settings" component={SettingsScreen} />
                <Stack.Screen name="Profile" component={ProfileScreen} />
                <Stack.Screen name="EditProfile" component={EditProfileScreen} />
                <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
                <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
                <Stack.Screen name="VerifyIdentity" component={VerifyIdentityScreen} />
                <Stack.Screen name="VerifyResetCode" component={VerifyResetCodeScreen} />
                <Stack.Screen name="VerifyRegisterCode" component={VerifyRegisterCodeScreen} />
                <Stack.Screen name="VerifyEmailChange" component={VerifyEmailChangeScreen} />
                <Stack.Screen name="RegisterMerchant" component={RegisterMerchantScreen} />
                <Stack.Screen name="VerifyMerchantCode" component={VerifyMerchantCodeScreen} />
                <Stack.Screen name="BusinessFormStep1" component={BusinessFormStep1Screen} />
                <Stack.Screen name="BusinessFormStep2" component={BusinessFormStep2Screen} />
                <Stack.Screen name="BusinessFormStep3" component={BusinessFormStep3Screen} />
                <Stack.Screen name="MerchantPendingApproval" component={MerchantPendingApprovalScreen} />
                <Stack.Screen name="ProfileMerchant" component={ProfileMerchantScreen} />
                <Stack.Screen name="EditMerchantProfile" component={EditMerchantProfileScreen} />
                <Stack.Screen name="Category" component={CategoryScreen} />
                <Stack.Screen name="MerchantProfile" component={MerchantProfileScreen} />
                <Stack.Screen name="Security" component={SecurityScreen} />
                <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
                <Stack.Screen name="Help" component={HelpScreen} />
                <Stack.Screen name="FAQ" component={FAQScreen} />
                <Stack.Screen name="PaymentMethods" component={PaymentMethodsScreen} />
                <Stack.Screen name="Cart" component={CartScreen} />
                <Stack.Screen name="Checkout" component={CheckoutScreen} />
                <Stack.Screen name="OrderConfirmation" component={OrderConfirmationScreen} />
                <Stack.Screen name="OrderManagement" component={OrderManagementScreen} />
                <Stack.Screen name="Favorites" component={FavoritesScreen} />
                <Stack.Screen name="DeliveryNavigation" component={DeliveryNavigationScreen} />
                <Stack.Screen name="DeliveryNavigationSimple" component={DeliveryNavigationScreenSimple} />
                <Stack.Screen name="OrderTracking" component={OrderTrackingScreen} />
                <Stack.Screen name="HomeDelivery" component={SimpleHomeDeliveryScreen} />
                <Stack.Screen name="HomeDeliveryOriginal" component={HomeDeliveryScreen} />
                <Stack.Screen name="DeliveryHistory" component={DeliveryHistoryScreen} />
                <Stack.Screen name="MerchantLocation" component={MerchantLocationScreen} />
                <Stack.Screen name="ClientLocationSetup" component={ClientLocationSetupScreen} />
                <Stack.Screen name="TestMap" component={TestMapScreen} />
              </Stack.Navigator>
              
              <OrderStatusNotifier />
            </NavigationContainer>
          </CartProvider>
        </ThemeProvider>
      </SafeAreaWrapper>
    </SafeAreaProvider>
  );
}