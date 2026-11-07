import React, { useState } from 'react';
import {
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
import { useCart } from '../context/CartContext';
import { placeOrder, validateCheckout, type CheckoutErrors } from '../lib/orders';
import { PrimaryButton } from '../components/PrimaryButton';
import { COLORS, RADII } from '../theme';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';

type CheckoutScreenProps = NativeStackScreenProps<RootStackParamList, 'Checkout'>;

export function CheckoutScreen({ navigation }: CheckoutScreenProps) {
  const { lines, itemCount, subtotal, deliveryFee, total, clearCart } = useCart();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [errors, setErrors] = useState<CheckoutErrors>({});
  const [placing, setPlacing] = useState(false);

  async function handlePlaceOrder() {
    if (placing) return;
    const validation = validateCheckout({ name, phone, address });
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;

    setPlacing(true);
    try {
      const orderId = await placeOrder({ name, phone, address }, lines);
      clearCart();
      navigation.replace('OrderSuccess', {
        orderId,
        total,
        itemCount,
      });
    } catch (error) {
      console.error('Order placement failed:', error);
      Alert.alert(
        'Order Failed',
        'We could not reach the kitchen. Please check your internet connection and try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setPlacing(false);
    }
  }

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
              <Text style={styles.summaryText}>
                {itemCount} item{itemCount === 1 ? '' : 's'} · {lines.map((l) => l.item.name).join(', ')}
              </Text>
            </View>
            <View style={styles.summaryAmounts}>
              <Text style={styles.summarySub}>₹{subtotal} + ₹{deliveryFee} delivery</Text>
              <Text style={styles.summaryTotal}>₹{total}</Text>
            </View>
          </View>

          {/* Delivery details */}
          <Text style={styles.sectionTitle}>Delivery Details</Text>
          <View style={styles.formCard}>
            <View style={styles.field}>
              <Text style={styles.label}>Full Name</Text>
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
              Testing only — UPI / cards will be added before launch.
            </Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <PrimaryButton
            title={`Place Order · ₹${total}`}
            onPress={handlePlaceOrder}
            loading={placing}
            disabled={lines.length === 0}
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
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
  },
  summaryCard: {
    backgroundColor: COLORS.limeSoft,
    borderWidth: 1,
    borderColor: '#D9F0B4',
    borderRadius: RADII.lg,
    padding: 14,
    gap: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  summaryText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },
  summaryAmounts: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summarySub: {
    fontSize: 12.5,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  summaryTotal: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.primary,
  },
  sectionTitle: {
    fontSize: 15.5,
    fontWeight: '800',
    color: COLORS.text,
    marginTop: 20,
    marginBottom: 10,
  },
  formCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADII.lg,
    padding: 16,
    gap: 16,
  },
  field: {
    gap: 7,
  },
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
  inputError: {
    borderColor: COLORS.danger,
  },
  addressInput: {
    minHeight: 88,
    paddingTop: 12,
  },
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
  errorText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.danger,
    marginTop: 2,
  },
  paymentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.card,
    borderWidth: 1.6,
    borderRadius: RADII.lg,
    padding: 15,
  },
  paymentSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.limeSoft,
  },
  paymentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
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
  paymentTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: COLORS.text,
  },
  paymentNote: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: COLORS.primary,
  },
  testingNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 4,
  },
  testingText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.limeDeep,
    fontWeight: '600',
  },
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
