import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADII } from '../theme';
import { BRAND_NAME } from '../config';

/** Shown instead of the app when Firebase env vars are missing or invalid. */
export function ConfigErrorScreen({ message }: { message: string }) {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.iconWrap}>
          <Ionicons name="settings-outline" size={40} color={COLORS.lime} />
        </View>
        <Text style={styles.title}>{BRAND_NAME}</Text>
        <Text style={styles.subtitle}>Firebase setup required</Text>

        <View style={styles.card}>
          <Text style={styles.message}>{message}</Text>
          <Text style={styles.stepTitle}>To fix this:</Text>
          <Text style={styles.step}>1. Open the Firebase Console and select your project.</Text>
          <Text style={styles.step}>
            2. Project settings → General → Your apps → copy the Web app config.
          </Text>
          <Text style={styles.step}>3. Paste the values into the .env file (see .env.example).</Text>
          <Text style={styles.step}>
            4. Set EXPO_PUBLIC_API_BASE_URL to the backend URL (Vercel app — see README).
          </Text>
          <Text style={styles.step}>5. Save the file and restart the app.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.primary,
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 24,
    backgroundColor: 'rgba(163, 230, 53, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.lime,
    marginTop: 6,
    marginBottom: 22,
  },
  card: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderRadius: RADII.lg,
    padding: 20,
    gap: 8,
  },
  message: {
    fontSize: 13.5,
    lineHeight: 20,
    color: COLORS.danger,
    fontWeight: '600',
    marginBottom: 6,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
  },
  step: {
    fontSize: 13,
    lineHeight: 20,
    color: COLORS.textMuted,
  },
});
