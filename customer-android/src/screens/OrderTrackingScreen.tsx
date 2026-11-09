import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
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
import { WebView } from 'react-native-webview';
import {
  cancelMyOrder,
  canCancel,
  friendlyOrderError,
  subscribeOrder,
} from '../lib/orders';
import { COLORS, RADII } from '../theme';
import type { CustomerOrder, OrderStatus } from '../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';

type OrderTrackingScreenProps = NativeStackScreenProps<RootStackParamList, 'OrderTracking'>;

/** The happy-path pipeline shown as a visual timeline (§8). */
const TIMELINE: OrderStatus[] = [
  'Order Placed',
  'Accepted',
  'Preparing',
  'Out for Delivery',
  'Delivered',
];

const STEP_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  'Order Placed': 'receipt-outline',
  Accepted: 'checkmark-circle-outline',
  Preparing: 'restaurant-outline',
  'Out for Delivery': 'bicycle-outline',
  Delivered: 'home-outline',
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

function timeAgo(millis: number | null): string {
  if (!millis) return '';
  const seconds = Math.max(0, Math.round((Date.now() - millis) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

/** OpenStreetMap (Leaflet) page rendered inside a WebView — no API key, no
 *  simulated data: the marker position comes straight from the driver's GPS. */
function buildMapHtml(lat: number, lng: number, label: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
  html, body, #map { height: 100%; margin: 0; padding: 0; background: #eef3ee; }
  .bhb-pin {
    width: 22px; height: 22px; border-radius: 50% 50% 50% 4px;
    background: #4D7C0F; border: 3px solid #ffffff;
    box-shadow: 0 2px 8px rgba(11,61,46,.45);
    transform: rotate(-45deg);
  }
  .bhb-pulse { border-radius: 50%; background: rgba(163,230,53,.35); border: 2px solid #4D7C0F; }
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var map = L.map('map', { zoomControl: false, attributionControl: false });
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
  var marker = null;
  var pulsar = null;
  function place(lat, lng) {
    var target = [lat, lng];
    if (!marker) {
      marker = L.marker(target, {
        icon: L.divIcon({ className: '', html: '<div class="bhb-pin"></div>', iconSize: [22, 22], iconAnchor: [11, 20] }),
      }).addTo(map).bindTooltip(${JSON.stringify(label)});
      pulsar = L.circle(target, { radius: 90, className: 'bhb-pulse' }).addTo(map);
      map.setView(target, 15);
    } else {
      marker.setLatLng(target);
      pulsar.setLatLng(target);
    }
  }
  place(${lat}, ${lng});
  window.updateDriverMarker = function (lat, lng) { place(lat, lng); };
</script>
</body>
</html>`;
}

export function OrderTrackingScreen({ navigation, route }: OrderTrackingScreenProps) {
  const { orderId } = route.params;
  const [order, setOrder] = useState<CustomerOrder | null>(null);
  const [missing, setMissing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const webViewRef = useRef<WebView>(null);
  const lastLocationRef = useRef<string>('');

  useEffect(() => {
    const unsubscribe = subscribeOrder(
      orderId,
      (next) => {
        setOrder(next);
        if (!next) setMissing(true);
      },
      (error) => setLoadError(error.message)
    );
    return unsubscribe;
  }, [orderId]);

  // Push every fresh GPS fix into the Leaflet map without reloading the page.
  useEffect(() => {
    const location = order?.driverLocation;
    if (!location) return;
    const key = `${location.lat},${location.lng}`;
    if (key === lastLocationRef.current) return;
    lastLocationRef.current = key;
    webViewRef.current?.injectJavaScript(
      `window.updateDriverMarker && window.updateDriverMarker(${location.lat}, ${location.lng}); true;`
    );
  }, [order?.driverLocation]);

  const stepIndex = useMemo(() => {
    if (!order) return -1;
    return TIMELINE.indexOf(order.status);
  }, [order]);

  const terminalBad = order?.status === 'Rejected' || order?.status === 'Cancelled';

  const statusTimestamp = (status: OrderStatus): number | null => {
    if (!order) return null;
    const events = order.statusHistory.filter((event) => event.status === status);
    const last = events[events.length - 1];
    return last?.at ?? null;
  };

  async function confirmCancel() {
    if (!order) return;
    setCancelOpen(false);
    setCancelling(true);
    try {
      await cancelMyOrder(order.orderId, cancelReason.trim());
    } catch (error) {
      setCancelReason('');
      // Surface the backend rejection (e.g. kitchen already preparing).
      const detail = friendlyOrderError(error);
      // eslint-disable-next-line no-alert
      globalThis.alert?.(detail);
    } finally {
      setCancelling(false);
    }
  }

  if (missing) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header onBack={() => navigation.goBack()} title="Track Order" />
        <View style={styles.center}>
          <Ionicons name="file-tray-full-outline" size={42} color={COLORS.textMuted} />
          <Text style={styles.emptyTitle}>Order not found</Text>
          <Text style={styles.emptyText}>This order may have been removed.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header onBack={() => navigation.goBack()} title="Track Order" />
        <View style={styles.center}>
          {loadError ? (
            <>
              <Ionicons name="cloud-offline-outline" size={42} color={COLORS.danger} />
              <Text style={styles.emptyTitle}>Connection problem</Text>
              <Text style={styles.emptyText}>{loadError}</Text>
            </>
          ) : (
            <ActivityIndicator size="large" color={COLORS.limeDeep} />
          )}
        </View>
      </SafeAreaView>
    );
  }

  const showMap =
    order.driverLocation !== null &&
    (order.status === 'Out for Delivery' || order.status === 'Delivered');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="dark" />
      <Header onBack={() => navigation.goBack()} title="Track Order" />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Status hero */}
        <View style={[styles.hero, terminalBad && styles.heroBad]}>
          <View style={styles.heroRow}>
            <Text style={styles.heroOrderId}>{order.orderId}</Text>
            <View style={[styles.heroChip, terminalBad && styles.heroChipBad]}>
              <View style={styles.heroDot} />
              <Text style={styles.heroChipText}>{order.status}</Text>
            </View>
          </View>
          <Text style={styles.heroSub}>
            Updated {formatWhen(order.updatedAt)}
            {order.updatedAt ? ` · ${timeAgo(order.updatedAt)}` : ''}
          </Text>
          {terminalBad && order.cancelReason ? (
            <Text style={styles.reason}>
              {order.status === 'Rejected' ? 'Rejected by the restaurant: ' : 'Cancelled: '}
              {order.cancelReason}
            </Text>
          ) : null}
        </View>

        {/* Timeline (hidden for rejected/cancelled — the hero already explains) */}
        {!terminalBad ? (
          <View style={styles.sectionCard}>
            {TIMELINE.map((step, index) => {
              const done = stepIndex > index || order.status === step;
              const active = stepIndex === index && step !== 'Delivered';
              const at = statusTimestamp(step);
              return (
                <View style={styles.stepRow} key={step}>
                  <View style={styles.stepRail}>
                    <View style={[styles.stepDot, done && styles.stepDotDone, active && styles.stepDotActive]}>
                      <Ionicons
                        name={STEP_ICONS[step] ?? 'ellipse-outline'}
                        size={13}
                        color={done ? COLORS.primary : COLORS.textMuted}
                      />
                    </View>
                    {index < TIMELINE.length - 1 ? (
                      <View style={[styles.stepLine, stepIndex > index && styles.stepLineDone]} />
                    ) : null}
                  </View>
                  <View style={styles.stepBody}>
                    <Text style={[styles.stepTitle, done && styles.stepTitleDone]}>
                      {step}
                      {active ? ' · current' : ''}
                    </Text>
                    <Text style={styles.stepTime}>{at ? formatWhen(at) : 'Pending'}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}

        {/* Driver + live map (§9) */}
        {order.driverName && (order.status === 'Out for Delivery' || order.status === 'Delivered') ? (
          <View style={styles.sectionCard}>
            <View style={styles.driverRow}>
              <View style={styles.driverAvatar}>
                <Ionicons name="bicycle" size={20} color={COLORS.primary} />
              </View>
              <View style={styles.driverInfo}>
                <Text style={styles.driverName}>{order.driverName}</Text>
                <Text style={styles.driverNote}>
                  {showMap
                    ? order.driverLocation
                      ? `Live GPS · updated ${timeAgo(order.driverLocation.updatedAt)}`
                      : 'Waiting for the first GPS update…'
                    : 'Your delivery partner'}
                </Text>
              </View>
            </View>
            {showMap && order.driverLocation ? (
              <View style={styles.mapWrap}>
                <WebView
                  ref={webViewRef}
                  originWhitelist={['*']}
                  source={{ html: buildMapHtml(order.driverLocation.lat, order.driverLocation.lng, order.driverName) }}
                  style={styles.map}
                  scrollEnabled={false}
                />
                <Text style={styles.mapNote}>Live driver position · OpenStreetMap</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Bill (§8: item prices, subtotal, delivery fee, total) */}
        <View style={styles.sectionCard}>
          <Text style={styles.cardTitle}>Order Bill</Text>
          {order.items.map((item, index) => (
            <View style={styles.billRow} key={`${item.productId}-${index}`}>
              <Text style={styles.billQty}>{item.quantity}×</Text>
              <View style={styles.billName}>
                <Text style={styles.billNameText} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.billUnit}>₹{item.unitPrice} each</Text>
              </View>
              <Text style={styles.billLine}>₹{item.lineTotal}</Text>
            </View>
          ))}
          <View style={styles.billDivider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Item Subtotal</Text>
            <Text style={styles.totalValue}>₹{order.subtotal}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Delivery Fee</Text>
            <Text style={styles.totalValue}>₹{order.deliveryFee}</Text>
          </View>
          <View style={[styles.totalRow, styles.grandRow]}>
            <Text style={styles.grandLabel}>Total ({order.paymentMethod})</Text>
            <Text style={styles.grandValue}>₹{order.total}</Text>
          </View>
        </View>

        {/* Delivery address */}
        <View style={styles.sectionCard}>
          <Text style={styles.cardTitle}>Delivery Address</Text>
          {order.address.label ? <Text style={styles.addressLabel}>{order.address.label}</Text> : null}
          <Text style={styles.addressName}>{order.address.receiverName}</Text>
          <Text style={styles.addressLine}>{order.address.line}</Text>
          {order.address.phone ? (
            <Pressable style={styles.phoneRow} onPress={() => void Linking.openURL(`tel:+91${order.address.phone}`)}>
              <Ionicons name="call-outline" size={14} color={COLORS.limeDeep} />
              <Text style={styles.phoneText}>+91 {order.address.phone}</Text>
            </Pressable>
          ) : null}
        </View>

        {/* Cancel while the kitchen has not started */}
        {canCancel(order.status) ? (
          <Pressable style={styles.cancelButton} disabled={cancelling} onPress={() => setCancelOpen(true)}>
            {cancelling ? (
              <ActivityIndicator size="small" color={COLORS.danger} />
            ) : (
              <Text style={styles.cancelText}>Cancel Order</Text>
            )}
          </Pressable>
        ) : null}
      </ScrollView>

      {/* Cancel confirmation (§14) */}
      <Modal visible={cancelOpen} transparent animationType="fade" onRequestClose={() => setCancelOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setCancelOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => undefined}>
            <Text style={styles.modalTitle}>Cancel this order?</Text>
            <Text style={styles.modalText}>Order {order.orderId} will be cancelled and the kitchen notified.</Text>
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
              <Pressable style={styles.modalKeep} onPress={() => setCancelOpen(false)}>
                <Text style={styles.modalKeepText}>Keep Order</Text>
              </Pressable>
              <Pressable style={styles.modalCancel} onPress={() => void confirmCancel()}>
                <Text style={styles.modalCancelText}>Cancel Order</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} hitSlop={10} accessibilityLabel="Go back">
        <Ionicons name="chevron-back" size={24} color={COLORS.primary} />
      </Pressable>
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={styles.headerSpacer} />
    </View>
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
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32, gap: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 6 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text, marginTop: 8 },
  emptyText: { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', lineHeight: 19 },
  hero: {
    backgroundColor: COLORS.limeSoft,
    borderWidth: 1,
    borderColor: '#D9F0B4',
    borderRadius: RADII.lg,
    padding: 14,
    gap: 6,
  },
  heroBad: { backgroundColor: COLORS.dangerSoft, borderColor: '#FECACA' },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroOrderId: { flex: 1, fontSize: 15, fontWeight: '900', color: COLORS.primary },
  heroChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.white,
    borderRadius: RADII.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  heroChipBad: { backgroundColor: '#FEF2F2' },
  heroDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.limeDeep },
  heroChipText: { fontSize: 12, fontWeight: '800', color: COLORS.primary },
  heroSub: { fontSize: 12, color: COLORS.textMuted },
  reason: { fontSize: 12.5, fontWeight: '600', color: COLORS.danger },
  sectionCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADII.lg,
    padding: 14,
    gap: 8,
  },
  cardTitle: { fontSize: 13, fontWeight: '800', color: COLORS.primary, letterSpacing: 0.3 },
  stepRow: { flexDirection: 'row', gap: 12 },
  stepRail: { alignItems: 'center' },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.surface,
    borderWidth: 1.4,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotDone: { backgroundColor: COLORS.lime, borderColor: COLORS.limeDeep },
  stepDotActive: { borderColor: COLORS.limeDeep, backgroundColor: COLORS.limeSoft },
  stepLine: { width: 2, flex: 1, minHeight: 18, backgroundColor: COLORS.border, marginVertical: 2 },
  stepLineDone: { backgroundColor: COLORS.limeDeep },
  stepBody: { flex: 1, paddingBottom: 10 },
  stepTitle: { fontSize: 13.5, fontWeight: '700', color: COLORS.textMuted },
  stepTitleDone: { color: COLORS.text },
  stepTime: { fontSize: 11.5, color: COLORS.textMuted, marginTop: 1 },
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  driverAvatar: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: COLORS.limeSoft,
    borderWidth: 1,
    borderColor: '#D9F0B4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverInfo: { flex: 1 },
  driverName: { fontSize: 14.5, fontWeight: '800', color: COLORS.text },
  driverNote: { fontSize: 12, color: COLORS.textMuted, marginTop: 1 },
  mapWrap: { borderRadius: RADII.md, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border },
  map: { height: 220, width: '100%', backgroundColor: COLORS.surface },
  mapNote: { fontSize: 10.5, color: COLORS.textMuted, marginTop: 6 },
  billRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  billQty: {
    minWidth: 26,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.primary,
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    paddingVertical: 3,
  },
  billName: { flex: 1 },
  billNameText: { fontSize: 13.5, fontWeight: '700', color: COLORS.text },
  billUnit: { fontSize: 11.5, color: COLORS.textMuted },
  billLine: { fontSize: 13.5, fontWeight: '700', color: COLORS.text },
  billDivider: { height: 1, backgroundColor: COLORS.border, marginVertical: 4 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between' },
  totalLabel: { fontSize: 13, color: COLORS.textMuted },
  totalValue: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  grandRow: { borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 8, marginTop: 2 },
  grandLabel: { fontSize: 14, fontWeight: '800', color: COLORS.primary },
  grandValue: { fontSize: 16, fontWeight: '900', color: COLORS.primary },
  addressLabel: {
    alignSelf: 'flex-start',
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.limeDeep,
    backgroundColor: COLORS.limeSoft,
    borderRadius: RADII.pill,
    paddingHorizontal: 9,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  addressName: { fontSize: 14, fontWeight: '800', color: COLORS.text },
  addressLine: { fontSize: 13, color: COLORS.textMuted, lineHeight: 18 },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  phoneText: { fontSize: 13, fontWeight: '700', color: COLORS.limeDeep },
  cancelButton: {
    borderWidth: 1.4,
    borderColor: COLORS.danger,
    borderRadius: RADII.pill,
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: COLORS.white,
  },
  cancelText: { color: COLORS.danger, fontWeight: '800', fontSize: 13.5 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(7,42,32,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: { width: '100%', maxWidth: 420, backgroundColor: COLORS.white, borderRadius: RADII.lg, padding: 18, gap: 10 },
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
  modalCancel: { borderRadius: RADII.pill, backgroundColor: COLORS.danger, paddingHorizontal: 16, paddingVertical: 9 },
  modalCancelText: { color: COLORS.white, fontWeight: '800', fontSize: 13 },
});
