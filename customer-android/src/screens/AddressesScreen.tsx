import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
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
import {
  addAddress,
  deleteAddress,
  subscribeAddresses,
  updateAddress,
  validateAddress,
  type SavedAddress,
} from '../lib/addresses';
import { COLORS, RADII } from '../theme';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';

type AddressesScreenProps = NativeStackScreenProps<RootStackParamList, 'Addresses'>;

interface AddressForm {
  label: string;
  receiverName: string;
  phone: string;
  line: string;
}

const EMPTY_FORM: AddressForm = { label: '', receiverName: '', phone: '', line: '' };

export function AddressesScreen({ navigation, route }: AddressesScreenProps) {
  const { user, profile, refreshProfile } = useAuth();
  const pickMode = route.params?.pickMode === true;
  const [addresses, setAddresses] = useState<SavedAddress[] | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AddressForm>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeAddresses(
      user.uid,
      (list) => setAddresses(list),
      (error) => {
        setAddresses([]);
        Alert.alert('Could not load addresses', error.message);
      }
    );
    return unsubscribe;
  }, [user]);

  function openAdd() {
    setEditingId(null);
    setForm({
      ...EMPTY_FORM,
      receiverName: profile?.name ?? user?.displayName ?? '',
      phone: profile?.phone ?? '',
    });
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(address: SavedAddress) {
    setEditingId(address.id);
    setForm({
      label: address.label,
      receiverName: address.receiverName,
      phone: address.phone,
      line: address.line,
    });
    setFormError(null);
    setFormOpen(true);
  }

  async function save() {
    if (saving) return;
    const problem = validateAddress(form);
    if (problem) {
      setFormError(problem);
      return;
    }
    setSaving(true);
    try {
      if (editingId) await updateAddress(editingId, form);
      else await addAddress(user!.uid, form);
      // Remember the last-used phone on the profile for faster checkout.
      if (profile && profile.phone !== form.phone.trim()) {
        const { doc, updateDoc } = await import('firebase/firestore');
        const { getDb } = await import('../lib/firebase');
        await updateDoc(doc(getDb(), 'users', user!.uid), { phone: form.phone.trim() });
        void refreshProfile();
      }
      setFormOpen(false);
    } catch (error) {
      setFormError(
        error instanceof Error && error.message.includes('permission')
          ? 'You can only edit your own addresses.'
          : 'Could not save this address. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(address: SavedAddress) {
    Alert.alert('Delete this address?', `${address.label} — ${address.line.slice(0, 60)}…`, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void deleteAddress(address.id).catch(() =>
            Alert.alert('Could not delete', 'Please try again.')
          );
        },
      },
    ]);
  }

  function pick(address: SavedAddress) {
    if (!pickMode) return;
    navigation.popToTop();
    navigation.navigate({
      name: 'Checkout',
      params: { pickedAddress: { ...address } },
      merge: true,
    } as never);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={24} color={COLORS.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>{pickMode ? 'Choose Address' : 'Saved Addresses'}</Text>
        <View style={styles.headerSpacer} />
      </View>

      {addresses === null ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.limeDeep} />
        </View>
      ) : addresses.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="location-outline" size={44} color={COLORS.limeDeep} />
          <Text style={styles.emptyTitle}>No saved addresses</Text>
          <Text style={styles.emptyText}>
            Save your home or office address once — checkout becomes one tap.
          </Text>
        </View>
      ) : (
        <FlatList
          data={addresses}
          keyExtractor={(address) => address.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() => pick(item)}
              disabled={!pickMode}
              accessibilityLabel={pickMode ? `Use ${item.label} address` : undefined}
            >
              <View style={styles.cardTopRow}>
                <View style={styles.labelChip}>
                  <Text style={styles.labelText}>{item.label}</Text>
                </View>
                {!pickMode ? (
                  <View style={styles.cardActions}>
                    <Pressable hitSlop={8} onPress={() => openEdit(item)} style={styles.iconButton}>
                      <Ionicons name="pencil" size={16} color={COLORS.limeDeep} />
                    </Pressable>
                    <Pressable hitSlop={8} onPress={() => confirmDelete(item)} style={styles.iconButton}>
                      <Ionicons name="trash-outline" size={16} color={COLORS.danger} />
                    </Pressable>
                  </View>
                ) : (
                  <Ionicons name="checkmark-circle" size={20} color={COLORS.limeDeep} />
                )}
              </View>
              <Text style={styles.cardName}>{item.receiverName}</Text>
              <Text style={styles.cardLine}>{item.line}</Text>
              <Text style={styles.cardPhone}>+91 {item.phone}</Text>
            </Pressable>
          )}
        />
      )}

      <View style={styles.footer}>
        <Pressable style={styles.addButton} onPress={openAdd}>
          <Ionicons name="add" size={18} color={COLORS.lime} />
          <Text style={styles.addButtonText}>Add New Address</Text>
        </Pressable>
      </View>

      {/* Add / edit dialog */}
      <Modal visible={formOpen} transparent animationType="fade" onRequestClose={() => setFormOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
          <Pressable style={styles.modalBackdropInner} onPress={() => setFormOpen(false)}>
            <Pressable style={styles.modalCard} onPress={() => undefined}>
              <ScrollView keyboardShouldPersistTaps="handled">
                <Text style={styles.modalTitle}>{editingId ? 'Edit Address' : 'New Address'}</Text>
                <Text style={styles.fieldLabel}>Label (e.g. Home, Office)</Text>
                <TextInput
                  style={styles.input}
                  value={form.label}
                  onChangeText={(text) => setForm((prev) => ({ ...prev, label: text }))}
                  placeholder="Home"
                  placeholderTextColor={COLORS.textMuted}
                  maxLength={40}
                />
                <Text style={styles.fieldLabel}>Receiver Name</Text>
                <TextInput
                  style={styles.input}
                  value={form.receiverName}
                  onChangeText={(text) => setForm((prev) => ({ ...prev, receiverName: text }))}
                  placeholder="e.g. Aarav Sharma"
                  placeholderTextColor={COLORS.textMuted}
                  autoCapitalize="words"
                  maxLength={80}
                />
                <Text style={styles.fieldLabel}>Mobile Number</Text>
                <View style={styles.phoneRow}>
                  <Text style={styles.phonePrefix}>+91</Text>
                  <TextInput
                    style={styles.phoneInput}
                    value={form.phone}
                    onChangeText={(text) => setForm((prev) => ({ ...prev, phone: text.replace(/\D/g, '').slice(0, 10) }))}
                    placeholder="10-digit mobile number"
                    placeholderTextColor={COLORS.textMuted}
                    keyboardType="number-pad"
                    maxLength={10}
                  />
                </View>
                <Text style={styles.fieldLabel}>Complete Address</Text>
                <TextInput
                  style={[styles.input, styles.lineInput]}
                  value={form.line}
                  onChangeText={(text) => setForm((prev) => ({ ...prev, line: text }))}
                  placeholder="Flat / house no., building, street, landmark, city, pincode"
                  placeholderTextColor={COLORS.textMuted}
                  multiline
                  maxLength={500}
                  textAlignVertical="top"
                />
                {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
                <View style={styles.modalActions}>
                  <Pressable style={styles.secondaryButton} onPress={() => setFormOpen(false)}>
                    <Text style={styles.secondaryText}>Cancel</Text>
                  </Pressable>
                  <Pressable style={styles.primaryButton} onPress={() => void save()} disabled={saving}>
                    {saving ? (
                      <ActivityIndicator size="small" color={COLORS.lime} />
                    ) : (
                      <Text style={styles.primaryText}>{editingId ? 'Save Changes' : 'Save Address'}</Text>
                    )}
                  </Pressable>
                </View>
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 6 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text, marginTop: 8 },
  emptyText: { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', lineHeight: 19 },
  list: { padding: 16, paddingBottom: 120, gap: 12 },
  card: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADII.lg,
    padding: 14,
    gap: 4,
  },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  labelChip: {
    backgroundColor: COLORS.limeSoft,
    borderWidth: 1,
    borderColor: '#D9F0B4',
    borderRadius: RADII.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  labelText: { fontSize: 11.5, fontWeight: '800', color: COLORS.limeDeep },
  cardActions: { flexDirection: 'row', gap: 6 },
  iconButton: { padding: 6 },
  cardName: { fontSize: 14.5, fontWeight: '800', color: COLORS.text },
  cardLine: { fontSize: 13, color: COLORS.textMuted, lineHeight: 18 },
  cardPhone: { fontSize: 12.5, color: COLORS.textMuted, marginTop: 2 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    borderRadius: RADII.pill,
    paddingVertical: 13,
  },
  addButtonText: { color: COLORS.lime, fontWeight: '800', fontSize: 14 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(7,42,32,0.5)', justifyContent: 'flex-end' },
  modalBackdropInner: { flex: 1, justifyContent: 'center', padding: 18 },
  modalCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADII.lg,
    padding: 18,
    maxHeight: '88%',
  },
  modalTitle: { fontSize: 17, fontWeight: '900', color: COLORS.text, marginBottom: 8 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: COLORS.primary, marginTop: 10, marginBottom: 5 },
  input: {
    borderWidth: 1.3,
    borderColor: COLORS.input,
    borderRadius: RADII.md,
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontSize: 14,
    color: COLORS.text,
    backgroundColor: COLORS.white,
  },
  lineInput: { minHeight: 90 },
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
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textMuted,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
  },
  phoneInput: { flex: 1, paddingHorizontal: 13, paddingVertical: 11, fontSize: 14, color: COLORS.text },
  errorText: { fontSize: 12, fontWeight: '600', color: COLORS.danger, marginTop: 8 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 16 },
  secondaryButton: {
    borderRadius: RADII.pill,
    borderWidth: 1.4,
    borderColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  secondaryText: { color: COLORS.primary, fontWeight: '800', fontSize: 13 },
  primaryButton: {
    borderRadius: RADII.pill,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    minWidth: 110,
    alignItems: 'center',
  },
  primaryText: { color: COLORS.lime, fontWeight: '800', fontSize: 13 },
});
