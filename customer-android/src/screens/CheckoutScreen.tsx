import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { subscribeAddresses, type SavedAddress } from '../lib/addresses';
import {
  fetchDeliveryFee,
  friendlyOrderError,
  placeOrder,
  validateCheckout,
  type CheckoutErrors,
} from '../lib/orders';
import { PrimaryButton } from '../components/PrimaryButton';
import { COLORS, RADII } from '../theme';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';

type CheckoutScreenProps = NativeStackScreenProps<RootStackParamList, 'Checkout'>;

/**
 * Checkout (§7): order summary → delivery address (saved or manual) → COD.
 *
 * SECURITY: the app sends ONLY product ids + quantities + the address.
 * Every price, discount, stock check and the final total are computed by the
 * `createOrder` Cloud Function — the server's bill is the one that counts.
 */
export function CheckoutScreen({ navigation, route }: CheckoutScreenProps) {
  const { lines, itemCount, subtotal, clearCart } = useCart();
  const { user, profile } = useAuth();

  const [addresses, setAddresses] = useState<SavedAddress[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);

  // Manual-entry fields (also pre-filled from the profile).
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [errors, setErrors] = useState<CheckoutErrors>({});

  const [deliveryFee, setDeliveryFee] = useState<number | null>(null);
  const [placing, setPlacing] = useState(false);

  // Saved-address feed (§3) — pre-select the newest one.
  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeAddresses(
      user.uid,
      (list) => {
        setAddresses(list);
        setSelectedId((current) => current ?? list[0]?.id ?? null);
      },
      () => setAddresses([])
    );
    return unsubscribe;
  }, [user]);

  // Pre-fill the manual form from the customer profile.
  useEffect(() => {
    setName((current) => current || profile?.name || user?.displayName || '');
    setPhone((current) => current || profile?.phone || '');
  }, [profile, user]);

  useEffect(() => {
    let active = true;
    fetchDeliveryFee().then((fee) => {
      if (active) setDeliveryFee(fee);
    });
    return () => {
      active = false;
    };
  }, []);

  // A freshly picked address (from the Addresses screen in pick mode).
  const pickedFromRoute = route.params?.pickedAddress;
  useEffect(() => {
    if (pickedFromRoute) {
      setSelectedId(pickedFromRoute.id);
      setManualOpen(false);
      navigation.setParams({ pickedAddress: undefined });
    }
  }, [pickedFromRoute, navigation]);

  const fee = deliveryFee ?? 20;
  const total = subtotal + (lines.length > 0 ? fee : 0);
  const selected = useMemo(
    () => addresses?.find((entry) => entry.id === selectedId) ?? null,
    [addresses, selectedId]
  );
  const usingSavedAddress = selected !== null && !manualOpen;

  async function handlePlaceOrder() {
    if (placing || lines.length === 0) return;

    const payload = usingSavedAddress
      ? {
          name: selected!.receiverName,
          phone: selected!.phone,
          address: selected!.line,
          label: selected!.label,
        }
      : { name, phone, address, label: '' };

    if (!usingSavedAddress) {
      const validation = validateCheckout(payload);
      setErrors(validation);
      if (Object.keys(validation).length > 0) return;
    }

    setPlacing(true);
    try {
      const placed = await placeOrder(payload, lines, profile?.name ?? name);
      clearCart();
      navigation.replace('OrderSuccess', {
        orderId: placed.orderId,
        total: placed.total,
        itemCount,
      });
    } catch (error) {
      Alert.alert(
        'Order Failed',
        friendlyOrderError(error),
        [{ text: 'OK' }]
      );
    } finally {
      setPlacing(false);
    }
  }

  const itemSummary = lines.map((line) => line.item.name).join(', ');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={24} color={COLORS.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>Checkout</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Order summary strip */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Ionicons name="bag-check" size={17} color={COLORS.limeDeep} />
              <Text style={styles.summaryText} numberOfLines={2}>
                {itemCount} item{itemCount === 1 ? '' : 's'} · {itemSummary}
              </Text>
            </View>
            <View style={styles.summaryAmounts}>
              <Text style={styles.summarySub}>
                ₹{subtotal} + {deliveryFee === null ? '…' : `₹${fee}`} delivery
              </Text>
              <Text style={styles.summaryTotal}>₹{total}</Text>
            </View>
          </View>

          {/* Delivery address */}
          <Text style={styles.sectionTitle}>Delivery Address</Text>
          {addresses !== null && addresses.length > 0 ? (
            <View style={styles.addressSection}>
              {addresses.map((entry) => {
                const active = usingSavedAddress && entry.id === selectedId;
                return (
                  <Pressable
                    key={entry.id}
                    style={[styles.addressCard, active && styles.addressCardActive]}
                    onPress={() => {
                      setSelectedId(entry.id);
                      setManualOpen(false);
                    }}
                  >
                    <View style={styles.radioOuter}>{active ? <View style={styles.radioInner} /> : null}</View>
                    <View style={styles.addressBody}>
                      <View style={styles.addressLabelRow}>
                        {entry.label ? (
                          <Text style={styles.addressLabel}>{entry.label}</Text>
                        ) : null}
                        <Text style={styles.addressName}>{entry.receiverName}</Text>
                      </View>
                      <Text style={styles.addressLine} numberOfLines={2}>
                        {entry.line}
                      </Text>
                      <Text style={styles.addressPhone}>+91 {entry.phone}</Text>
                    </View>
                  </Pressable>
                );
              })}
              <Pressable
                style={styles.linkRow}
                onPress={() => setManualOpen((open) => !open)}
              >
                <Ionicons
                  name={manualOpen ? 'checkbox' : 'square-outline'}
                  size={16}
                  color={COLORS.limeDeep}
                />
                <Text style={styles.linkText}>Enter a different address manually</Text>
              </Pressable>
              <Pressable
                style={styles.linkRow}
                onPress={() => navigation.navigate('Addresses', { pickMode: true })}
              >
                <Ionicons name="settings-outline" size={15} color={COLORS.limeDeep} />
                <Text style={styles.linkText}>Manage saved addresses</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              style={styles.addressCta}
              onPress={() => navigation.navigate('Addresses', { pickMode: true })}
            >
              <Ionicons name="add-circle-outline" size={20} color={COLORS.limeDeep} />
              <Text style={styles.addressCtaText}>Save an address for one-tap checkout</Text>
              <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
            </Pressable>
          )}

          {/* Manual entry (fallback / override) */}
          {(addresses === null || addresses.length === 0 || manualOpen) && (
            <View style={styles.formCard}>
              <View style={styles.field}>
                <Text style={styles.label}>Receiver Full Name</Text>
                <TextInput
                  style={[styles.input, errors.name && styles.inputError]}
                  value={name}
                  onChangeText={(text) => {
                    setName(text);
                    if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
                  }}
                  placeholder="e.g. Aarav Sharma"
                  placeholderTextColor={COLORS.textMuted}
                  autoCapitalize="words"
                  autoComplete="name"
                  maxLength={80}
                />
                {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Mobile Number</Text>
                <View style={[styles.phoneRow, errors.phone && styles.inputError]}>
                  <Text style={styles.phonePrefix}>+91</Text>
                  <TextInput
                    style={styles.phoneInput}
                    value={phone}
                    onChangeText={(text) => {
                      setPhone(text.replace(/\D/g, '').slice(0, 10));
                      if (errors.phone) setErrors((prev) => ({ ...prev, phone: undefined }));
                    }}
                    placeholder="10-digit mobile number"
                    placeholderTextColor={COLORS.textMuted}
                    keyboardType="number-pad"
                    maxLength={10}
                    autoComplete="tel"
                  />
                </View>
                {errors.phone ? <Text style={styles.errorText}>{errors.phone}</Text> : null}
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Complete Delivery Address</Text>
                <TextInput
                  style={[styles.input, styles.addressInput, errors.address && styles.inputError]}
                  value={address}
                  onChangeText={(text) => {
                    setAddress(text);
                    if (errors.address) setErrors((prev) => ({ ...prev, address: undefined }));
                  }}
                  placeholder="Flat / house no., building, street, landmark, city, pincode"
                  placeholderTextColor={COLORS.textMuted}
                  multiline
                  numberOfLines={3}
                  maxLength={500}
                  textAlignVertical="top"
                />
                {errors.address ? <Text style={styles.errorText}>{errors.address}</Text> : null}
              </View>
            </View>
          )}

          {/* Payment method */}
          <Text style={styles.sectionTitle}>Payment Method</Text>
          <View style={[styles.paymentCard, styles.paymentSelected]}>
            <View style={styles.paymentLeft}>
              <View style={styles.paymentIcon}>
                <Ionicons name="cash-outline" size={20} color={COLORS.primary} />
              </View>
              <View>
                <Text style={styles.paymentTitle}>Cash on Delivery</Text>
                <Text style={styles.paymentNote}>Pay in cash when your order arrives</Text>
              </View>
            </View>
            <View style={styles.radioOuter}>
              <View style={styles.radioInner} />
            </View>
          </View>
          <View style={styles.testingNote}>
            <Ionicons name="information-circle-outline" size={14} color={COLORS.limeDeep} />
            <Text style={styles.testingText}>
              Prices and totals are verified by the kitchen before confirmation.
            </Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <PrimaryButton
            title={`Place Order · ₹${total}`}
            onPress={handlePlaceOrder}
            loading={placing}
            disabled={lines.length === 0 || (usingSavedAddress && !selected)}
          />
          <Text style={styles.termsText}>
            By placing this order you agree to be available at the delivery address.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '800', color: COLORS.text },
  headerSpacer: { width: 24 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 24 },
  summaryCard: {
    backgroundColor: COLORS.limeSoft,
    borderWidth: 1,
    borderColor: '#D9F0B4',
    borderRadius: RADII.lg,
    padding: 14,
    gap: 8,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  summaryText: { flex: 1, fontSize: 13, fontWeight: '600', color: COLORS.primary },
  summaryAmounts: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summarySub: { fontSize: 12.5, color: COLORS.textMuted, fontWeight: '600' },
  summaryTotal: { fontSize: 18, fontWeight: '900', color: COLORS.primary },
  sectionTitle: {
    fontSize: 15.5,
    fontWeight: '800',
    color: COLORS.text,
    marginTop: 20,
    marginBottom: 10,
  },
  addressSection: { gap: 10 },
  addressCard: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    backgroundColor: COLORS.card,
    borderWidth: 1.6,
    borderColor: COLORS.border,
    borderRadius: RADII.lg,
    padding: 13,
  },
  addressCardActive: { borderColor: COLORS.primary, backgroundColor: COLORS.limeSoft },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary },
  addressBody: { flex: 1, gap: 2 },
  addressLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  addressLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    color: COLORS.limeDeep,
    backgroundColor: COLORS.white,
    borderRadius: RADII.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#D9F0B4',
  },
  addressName: { fontSize: 14, fontWeight: '800', color: COLORS.text },
  addressLine: { fontSize: 12.5, color: COLORS.textMuted, lineHeight: 17 },
  addressPhone: { fontSize: 12, color: COLORS.textMuted },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 4 },
  linkText: { fontSize: 12.5, fontWeight: '700', color: COLORS.limeDeep },
  addressCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderWidth: 1.4,
    borderStyle: 'dashed',
    borderColor: COLORS.input,
    borderRadius: RADII.lg,
    padding: 15,
    backgroundColor: COLORS.surface,
  },
  addressCtaText: { flex: 1, fontSize: 13, fontWeight: '700', color: COLORS.textMuted },
  formCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADII.lg,
    padding: 16,
    gap: 16,
    marginTop: 10,
  },
  field: { gap: 7 },
  label: {
    fontSize: 12.5,
    fontWeight: '700',
    color: COLORS.primary,
    letterSpacing: 0.2,
  },
  input: {
    borderWidth: 1.3,
    borderColor: COLORS.input,
    borderRadius: RADII.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14.5,
    color: COLORS.text,
    backgroundColor: COLORS.white,
  },
  inputError: { borderColor: COLORS.danger },
  addressInput: { minHeight: 88, paddingTop: 12 },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.3,
    borderColor: COLORS.input,
    borderRadius: RADII.md,
    backgroundColor: COLORS.white,
  },
  phonePrefix: {
    paddingHorizontal: 13,
    fontSize: 14.5,
    fontWeight: '700',
    color: COLORS.textMuted,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: 13,
    paddingVertical: 12,
    fontSize: 14.5,
    color: COLORS.text,
  },
  errorText: { fontSize: 12, fontWeight: '600', color: COLORS.danger, marginTop: 2 },
  paymentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.card,
    borderWidth: 1.6,
    borderRadius: RADII.lg,
    padding: 15,
  },
  paymentSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.limeSoft },
  paymentLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  paymentIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentTitle: { fontSize: 14.5, fontWeight: '800', color: COLORS.text },
  paymentNote: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  testingNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 4,
  },
  testingText: { flex: 1, fontSize: 12, color: COLORS.limeDeep, fontWeight: '600' },
  footer: {
    padding: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.background,
    gap: 8,
  },
  termsText: {
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 15,
  },
});
