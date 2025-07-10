import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

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
import VerifyCodeScreen from './components/VerifyCodeScreen';
import ForgotPasswordScreen from './components/ForgotPasswordScreen';
import ResetPasswordScreen from './components/ResetPasswordScreen';
import VerifyIdentityScreen from './components/VerifyIdentityScreen';



const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
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
        <Stack.Screen name="Startup" component={StartupScreen} />
        <Stack.Screen name="EditProfile" component={EditProfileScreen} />
        <Stack.Screen name="VerifyCode" component={VerifyCodeScreen} />
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
        <Stack.Screen name="VerifyIdentity" component={VerifyIdentityScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}



