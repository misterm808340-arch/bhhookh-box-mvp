import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { PrimaryButton } from '../components/PrimaryButton';
import { COLORS, RADII } from '../theme';
import { BRAND_NAME } from '../config';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';

type OrderSuccessScreenProps = NativeStackScreenProps<RootStackParamList, 'OrderSuccess'>;

export function OrderSuccessScreen({ navigation, route }: OrderSuccessScreenProps) {
  const { orderId, total, itemCount } = route.params;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <View style={styles.headerSpacer} />
        <Text style={styles.headerTitle}>Order Confirmed</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.body}>
        <View style={styles.checkCircle}>
          <Ionicons name="checkmark" size={54} color={COLORS.primaryDark} />
        </View>

        <Text style={styles.title}>Thank you! Order placed.</Text>
        <Text style={styles.subtitle}>
          Your food is being sent to the kitchen. Keep this order ID for reference:
        </Text>

        <View style={styles.idBox}>
          <Text style={styles.idLabel}>ORDER ID</Text>
          <Text style={styles.idValue}>{orderId}</Text>
        </View>

        <View style={styles.statusRow}>
          <View style={styles.statusChip}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>Status: Order Placed</Text>
          </View>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Items</Text>
            <Text style={styles.summaryValue}>{itemCount}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Amount payable (Cash on Delivery)</Text>
            <Text style={styles.summaryAmount}>₹{total}</Text>
          </View>
        </View>

        <Text style={styles.note}>
          The restaurant has been notified in real time and will accept your order shortly. You
          will pay ₹{total} in cash when it arrives.
        </Text>
      </View>

      <View style={styles.footer}>
        <PrimaryButton
          title="Track My Order"
          onPress={() => navigation.replace('OrderTracking', { orderId })}
        />
        <Pressable
          onPress={() => navigation.popToTop()}
          style={styles.secondaryLink}
          hitSlop={8}
        >
          <Text style={styles.secondaryLinkText}>Back to {BRAND_NAME}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.text,
  },
  headerSpacer: {
    width: 24,
  },
  secondaryLink: { alignItems: 'center', paddingVertical: 12 },
  secondaryLinkText: { color: COLORS.limeDeep, fontWeight: '700', fontSize: 13.5 },
  body: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 34,
  },
  checkCircle: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: COLORS.lime,
    borderWidth: 5,
    borderColor: COLORS.limeSoft,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  title: {
    marginTop: 22,
    fontSize: 23,
    fontWeight: '900',
    color: COLORS.text,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 13.5,
    lineHeight: 20,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  idBox: {
    marginTop: 20,
    width: '100%',
    borderWidth: 1.8,
    borderStyle: 'dashed',
    borderColor: COLORS.limeDeep,
    borderRadius: RADII.lg,
    backgroundColor: COLORS.limeSoft,
    alignItems: 'center',
    paddingVertical: 16,
    gap: 4,
  },
  idLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: COLORS.limeDeep,
  },
  idValue: {
    fontSize: 21,
    fontWeight: '900',
    color: COLORS.primary,
    letterSpacing: 1,
  },
  statusRow: {
    marginTop: 16,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: COLORS.amberSoft,
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: RADII.pill,
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F59E0B',
  },
  statusText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.amber,
  },
  summaryCard: {
    marginTop: 20,
    width: '100%',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADII.lg,
    padding: 16,
    gap: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    fontSize: 13.5,
    color: COLORS.textMuted,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  summaryAmount: {
    fontSize: 17,
    fontWeight: '900',
    color: COLORS.primary,
  },
  note: {
    marginTop: 16,
    fontSize: 12.5,
    lineHeight: 19,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  footer: {
    padding: 16,
  },
});
