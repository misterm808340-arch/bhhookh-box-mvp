import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { CartProvider } from './src/context/CartContext';
import { CatalogProvider } from './src/context/CatalogContext';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { readFirebaseConfig } from './src/lib/firebase';
import { ConfigErrorScreen } from './src/screens/ConfigErrorScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { RegisterScreen } from './src/screens/RegisterScreen';
import { VerifyEmailScreen } from './src/screens/VerifyEmailScreen';
import { ForgotPasswordScreen } from './src/screens/ForgotPasswordScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { CartScreen } from './src/screens/CartScreen';
import { CheckoutScreen } from './src/screens/CheckoutScreen';
import { OrderSuccessScreen } from './src/screens/OrderSuccessScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { MyOrdersScreen } from './src/screens/MyOrdersScreen';
import { OrderTrackingScreen } from './src/screens/OrderTrackingScreen';
import { AddressesScreen } from './src/screens/AddressesScreen';
import { ReorderScreen } from './src/screens/ReorderScreen';
import { DriverHomeScreen } from './src/screens/DriverHomeScreen';
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

/** Branded splash shown while the persisted session is being restored. */
function AuthSplash() {
  return (
    <SafeAreaView style={styles.splash}>
      <StatusBar style="dark" />
      <View style={styles.splashBadge}>
        <Text style={styles.splashLogo}>BB</Text>
      </View>
      <Text style={styles.splashBrand}>BHHOOKH BOX</Text>
      <Text style={styles.splashTagline}>Fresh. Fast. Delivered.</Text>
      <ActivityIndicator color={COLORS.limeDeep} style={{ marginTop: 28 }} />
    </SafeAreaView>
  );
}

/** Decides which screen tree is visible based on the auth phase. */
function RootNavigator() {
  const { phase, role } = useAuth();

  if (phase === 'loading') return <AuthSplash />;

  if (phase === 'signedOut') {
    return (
      <Stack.Navigator
        initialRouteName="Login"
        screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
      >
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen
          name="ForgotPassword"
          component={ForgotPasswordScreen}
          options={{ animation: 'fade' }}
        />
      </Stack.Navigator>
    );
  }

  if (phase === 'unverified') {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false, gestureEnabled: false }}>
        <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
      </Stack.Navigator>
    );
  }

  // phase === 'signedIn' — driver accounts land in the delivery console (§9);
  // every other verified session gets the full customer app.
  if (role === 'driver') {
    return <DriverHomeScreen />;
  }

  return (
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
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="MyOrders" component={MyOrdersScreen} />
      <Stack.Screen name="OrderTracking" component={OrderTrackingScreen} />
      <Stack.Screen name="Addresses" component={AddressesScreen} />
      <Stack.Screen name="Reorder" component={ReorderScreen} />
    </Stack.Navigator>
  );
}

// The customer-facing screens for orders / addresses / reorder are registered
// above; they live in their own modules.

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
      <AuthProvider>
        <CatalogProvider>
          <CartProvider>
            <NavigationContainer theme={navigationTheme}>
              <StatusBar style="dark" />
              <RootNavigator />
            </NavigationContainer>
          </CartProvider>
        </CatalogProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashBadge: {
    width: 76,
    height: 76,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashLogo: {
    color: COLORS.lime,
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 1,
  },
  splashBrand: {
    marginTop: 14,
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.primary,
    letterSpacing: 1.5,
  },
  splashTagline: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 4,
    letterSpacing: 0.4,
  },
});
