import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
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
  cancelMyOrder,
  canCancel,
  friendlyOrderError,
  isActiveStatus,
  subscribeMyOrders,
} from '../lib/orders';
import { COLORS, RADII } from '../theme';
import type { CustomerOrder } from '../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { useEffect } from 'react';
import { Modal } from 'react-native';

type MyOrdersScreenProps = NativeStackScreenProps<RootStackParamList, 'MyOrders'>;

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  'Order Placed': { bg: '#FEF3C7', text: '#B45309' },
  Accepted: { bg: '#E0F2F1', text: '#00695C' },
  Rejected: { bg: '#FEF2F2', text: '#DC2626' },
  Preparing: { bg: '#EDE9FE', text: '#6D28D9' },
  'Out for Delivery': { bg: '#E0F2FE', text: '#0369A1' },
  Delivered: { bg: '#DCFCE7', text: '#15803D' },
  Cancelled: { bg: '#F1F5F9', text: '#475569' },
};

function formatWhen(millis: number | null): string {
  if (!millis) return '';
  return new Date(millis).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/** One live order card — tap to open real-time tracking. */
function OrderCard({
  order,
  onPress,
  onCancel,
  cancelling,
}: {
  order: CustomerOrder;
  onPress: () => void;
  onCancel: () => void;
  cancelling: boolean;
}) {
  const palette = STATUS_COLORS[order.status] ?? STATUS_COLORS['Order Placed']!;
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const names = order.items.map((item) => item.name).join(', ');

  return (
    <Pressable style={styles.card} onPress={onPress} accessibilityLabel={`Track order ${order.orderId}`}>
      <View style={styles.cardTop}>
        <Text style={styles.orderId}>{order.orderId}</Text>
        <View style={[styles.statusChip, { backgroundColor: palette.bg }]}>
          <Text style={[styles.statusText, { color: palette.text }]}>{order.status}</Text>
        </View>
      </View>
      <Text style={styles.itemsLine} numberOfLines={2}>
        {itemCount} item{itemCount === 1 ? '' : 's'} · {names}
      </Text>
      <View style={styles.cardBottom}>
        <Text style={styles.when}>{formatWhen(order.createdAt)}</Text>
        <View style={styles.cardBottomRight}>
          <Text style={styles.total}>₹{order.total}</Text>
          <Text style={styles.payNote}>COD</Text>
          <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
        </View>
      </View>
      {order.cancelReason && order.status !== 'Delivered' ? (
        <Text style={styles.reason} numberOfLines={1}>
          {order.status === 'Rejected' ? 'Rejected: ' : 'Cancelled: '}
          {order.cancelReason}
        </Text>
      ) : null}
      {canCancel(order.status) ? (
        <Pressable
          style={styles.cancelButton}
          hitSlop={6}
          disabled={cancelling}
          onPress={(event) => {
            event.stopPropagation();
            onCancel();
          }}
        >
          {cancelling ? (
            <ActivityIndicator size="small" color={COLORS.danger} />
          ) : (
            <Text style={styles.cancelText}>Cancel Order</Text>
          )}
        </Pressable>
      ) : null}
    </Pressable>
  );
}

export function MyOrdersScreen({ navigation, route }: MyOrdersScreenProps) {
  const { user } = useAuth();
  const initialTab = route.params?.initialTab ?? 'active';
  const [tab, setTab] = useState<'active' | 'history'>(initialTab);
  const [orders, setOrders] = useState<CustomerOrder[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  /** Order awaiting the cancel-confirmation dialog (Android-safe, not Alert.prompt). */
  const [cancelTarget, setCancelTarget] = useState<CustomerOrder | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeMyOrders(
      user.uid,
      (list: CustomerOrder[]) => {
        setOrders(list);
        setLoadError(null);
      },
      (error: Error) => setLoadError(error.message)
    );
    return unsubscribe;
  }, [user]);

  const activeOrders = useMemo(
    () => (orders ?? []).filter((order) => isActiveStatus(order.status)),
    [orders]
  );
  const historyOrders = useMemo(
    () => (orders ?? []).filter((order) => !isActiveStatus(order.status)),
    [orders]
  );
  const visible = tab === 'active' ? activeOrders : historyOrders;

  async function confirmCancel() {
    if (!cancelTarget) return;
    setCancellingId(cancelTarget.id);
    setCancelTarget(null);
    try {
      await cancelMyOrder(cancelTarget.orderId, cancelReason.trim());
    } catch (error) {
      Alert.alert('Could not cancel', friendlyOrderError(error));
    } finally {
      setCancellingId(null);
      setCancelReason('');
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={24} color={COLORS.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>My Orders</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Tabs: Active orders ↔ Order history */}
      <View style={styles.tabs}>
        {(['active', 'history'] as const).map((value) => (
          <Pressable
            key={value}
            style={[styles.tab, tab === value && styles.tabActive]}
            onPress={() => setTab(value)}
          >
            <Text style={[styles.tabText, tab === value && styles.tabTextActive]}>
              {value === 'active' ? `Active Orders (${activeOrders.length})` : `Order History (${historyOrders.length})`}
            </Text>
          </Pressable>
        ))}
      </View>

      {loadError ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={40} color={COLORS.danger} />
          <Text style={styles.errorTitle}>Could not load your orders</Text>
          <Text style={styles.errorText}>{loadError}</Text>
        </View>
      ) : orders === null ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.limeDeep} />
        </View>
      ) : visible.length === 0 ? (
        <View style={styles.center}>
          <Ionicons
            name={tab === 'active' ? 'receipt-outline' : 'time-outline'}
            size={44}
            color={COLORS.limeDeep}
          />
          <Text style={styles.emptyTitle}>
            {tab === 'active' ? 'No active orders' : 'No past orders yet'}
          </Text>
          <Text style={styles.emptyText}>
            {tab === 'active'
              ? 'Orders you place will appear here with live status updates.'
              : 'Delivered, rejected and cancelled orders land in your history.'}
          </Text>
          {tab === 'history' ? (
            <Pressable style={styles.browseButton} onPress={() => navigation.navigate('Home')}>
              <Text style={styles.browseText}>Browse the menu</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(order) => order.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <OrderCard
              order={item}
              cancelling={cancellingId === item.id}
              onPress={() => navigation.navigate('OrderTracking', { orderId: item.orderId })}
              onCancel={() => setCancelTarget(item)}
            />
          )}
        />
      )}
      {/* Cancel confirmation dialog (§14: confirm before destructive actions) */}
      <Modal visible={cancelTarget !== null} transparent animationType="fade" onRequestClose={() => setCancelTarget(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setCancelTarget(null)}>
          <Pressable style={styles.modalCard} onPress={() => undefined}>
            <Text style={styles.modalTitle}>Cancel this order?</Text>
            <Text style={styles.modalText}>
              Order {cancelTarget?.orderId} will be cancelled and the kitchen will be notified.
            </Text>
            <TextInput
              style={styles.modalInput}
              value={cancelReason}
              onChangeText={setCancelReason}
              placeholder="Optional reason (e.g. ordered by mistake)"
              placeholderTextColor={COLORS.textMuted}
              maxLength={200}
              multiline
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.modalKeep} onPress={() => setCancelTarget(null)}>
                <Text style={styles.modalKeepText}>Keep Order</Text>
              </Pressable>
              <Pressable style={styles.modalCancel} onPress={() => void confirmCancel()} disabled={cancellingId !== null}>
                <Text style={styles.modalCancelText}>
                  {cancellingId ? 'Cancelling…' : 'Cancel Order'}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
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
  tabs: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: RADII.pill,
    borderWidth: 1.4,
    borderColor: COLORS.border,
    alignItems: 'center',
    backgroundColor: COLORS.card,
  },
  tabActive: { borderColor: COLORS.primary, backgroundColor: COLORS.limeSoft },
  tabText: { fontSize: 12.5, fontWeight: '700', color: COLORS.textMuted },
  tabTextActive: { color: COLORS.primary },
  list: { padding: 16, paddingTop: 2, paddingBottom: 24, gap: 12 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADII.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    gap: 8,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  orderId: { flex: 1, fontSize: 14, fontWeight: '800', color: COLORS.primary },
  statusChip: { borderRadius: RADII.pill, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 11, fontWeight: '800' },
  itemsLine: { fontSize: 13, color: COLORS.textMuted },
  cardBottom: { flexDirection: 'row', alignItems: 'center' },
  when: { flex: 1, fontSize: 12, color: COLORS.textMuted },
  cardBottomRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  total: { fontSize: 15.5, fontWeight: '900', color: COLORS.primary },
  payNote: {
    fontSize: 10.5,
    fontWeight: '800',
    color: COLORS.limeDeep,
    backgroundColor: COLORS.limeSoft,
    borderRadius: RADII.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  reason: { fontSize: 12, color: COLORS.danger, fontWeight: '600' },
  cancelButton: {
    alignSelf: 'flex-start',
    marginTop: 2,
    borderRadius: RADII.pill,
    borderWidth: 1.3,
    borderColor: COLORS.danger,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  cancelText: { fontSize: 12, fontWeight: '700', color: COLORS.danger },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 6 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text, marginTop: 8 },
  emptyText: { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', lineHeight: 19 },
  browseButton: {
    marginTop: 14,
    backgroundColor: COLORS.primary,
    borderRadius: RADII.pill,
    paddingHorizontal: 20,
    paddingVertical: 11,
  },
  browseText: { color: COLORS.lime, fontWeight: '800', fontSize: 13.5 },
  errorTitle: { fontSize: 15.5, fontWeight: '800', color: COLORS.text, marginTop: 8 },
  errorText: { fontSize: 12.5, color: COLORS.textMuted, textAlign: 'center' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(7,42,32,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: COLORS.white,
    borderRadius: RADII.lg,
    padding: 18,
    gap: 10,
  },
  modalTitle: { fontSize: 16.5, fontWeight: '900', color: COLORS.text },
  modalText: { fontSize: 13, color: COLORS.textMuted, lineHeight: 18 },
  modalInput: {
    borderWidth: 1.3,
    borderColor: COLORS.input,
    borderRadius: RADII.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13.5,
    color: COLORS.text,
    minHeight: 64,
    textAlignVertical: 'top',
    backgroundColor: COLORS.surface,
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 4 },
  modalKeep: {
    borderRadius: RADII.pill,
    borderWidth: 1.4,
    borderColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  modalKeepText: { color: COLORS.primary, fontWeight: '800', fontSize: 13 },
  modalCancel: {
    borderRadius: RADII.pill,
    backgroundColor: COLORS.danger,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  modalCancelText: { color: COLORS.white, fontWeight: '800', fontSize: 13 },
});
