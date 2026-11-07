import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { CartProvider } from './src/context/CartContext';
import { readFirebaseConfig } from './src/lib/firebase';
import { ConfigErrorScreen } from './src/screens/ConfigErrorScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { CartScreen } from './src/screens/CartScreen';
import { CheckoutScreen } from './src/screens/CheckoutScreen';
import { OrderSuccessScreen } from './src/screens/OrderSuccessScreen';
import { COLORS } from './src/theme';
import type { RootStackParamList } from './src/navigation';

const Stack = createNativeStackNavigator<RootStackParamList>();

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: COLORS.background,
    primary: COLORS.primary,
    card: COLORS.background,
    text: COLORS.text,
  },
};

export default function App() {
  // Fail loudly (with instructions) when Firebase env vars are missing —
  // never silently simulate connectivity.
  const config = readFirebaseConfig();
  if (!config) {
    const message =
      'Firebase environment variables are missing. Add EXPO_PUBLIC_FIREBASE_* values from your Firebase project to the .env file (see .env.example) and restart the app.';
    return (
      <SafeAreaProvider>
        <ConfigErrorScreen message={message} />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <CartProvider>
        <NavigationContainer theme={navigationTheme}>
          <StatusBar style="dark" />
          <Stack.Navigator
            initialRouteName="Home"
            screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
          >
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="Cart" component={CartScreen} />
            <Stack.Screen name="Checkout" component={CheckoutScreen} />
            <Stack.Screen
              name="OrderSuccess"
              component={OrderSuccessScreen}
              options={{ animation: 'fade' }}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </CartProvider>
    </SafeAreaProvider>
  );
}
