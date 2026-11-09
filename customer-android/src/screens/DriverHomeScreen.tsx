import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  FlatList,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useAuth } from '../context/AuthContext';
import {
  publishDriverLocation,
  setDriverOrderStatus,
  subscribeAssignedOrders,
  type DriverProfile,
} from '../lib/driver';
import { logoutCustomer } from '../lib/auth';
import { COLORS, RADII } from '../theme';
import type { CustomerOrder } from '../types';

/**
 * Driver console (§9).
 *
 * - Lists ONLY orders assigned to this driver (Firestore rules enforce it).
 * - Status hand-off: Preparing → Out for Delivery → Delivered, through the
 *   `updateOrderStatus` Cloud Function (server re-checks every transition).
 * - REAL GPS: with the driver's permission, expo-location streams fixes while
 *   the app is open and each fix is written to `orders/{id}.driverLocation`
 *   so the customer's map follows the actual rider. No simulated coordinates
 *   exist anywhere; without permission the driver sees an explicit warning
 *   and tracking stays off.
 */

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
  return `${Math.round(minutes / 60)} min ago`;
}

function DriverOrderCard({ order, acting, onAdvance }: {
  order: CustomerOrder;
  acting: string | null;
  onAdvance: (order: CustomerOrder) => void;
}) {
  const canStart = order.status === 'Preparing';
  const canDeliver = order.status === 'Out for Delivery';

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={styles.orderId}>{order.orderId}</Text>
        <View style={[styles.statusChip, canDeliver ? styles.statusChipLive : undefined]}>
          <Text style={styles.statusText}>{order.status}</Text>
        </View>
      </View>

      <View style={styles.addressBlock}>
        <View style={styles.addressRow}>
          <Ionicons name="person-outline" size={13} color={COLORS.limeDeep} />
          <Text style={styles.addressText} numberOfLines={1}>
            {order.address.receiverName} · {order.address.label || 'Delivery'}
          </Text>
        </View>
        <Text style={styles.addressLine} numberOfLines={2}>{order.address.line}</Text>
        <View style={styles.addressActions}>
          <Pressable
            style={styles.callButton}
            onPress={() => void Linking.openURL(`tel:+91${order.address.phone}`)}
          >
            <Ionicons name="call" size={13} color={COLORS.primary} />
            <Text style={styles.callText}>Call customer</Text>
          </Pressable>
          <View style={styles.codChip}>
            <Text style={styles.codText}>Collect ₹{order.total} COD</Text>
          </View>
        </View>
      </View>

      <Text style={styles.itemsLine} numberOfLines={2}>
        {order.items.map((item) => `${item.quantity}× ${item.name}`).join(', ')}
      </Text>

      <View style={styles.actionsRow}>
        {canStart ? (
          <Pressable
            style={styles.primaryAction}
            onPress={() => onAdvance(order)}
            disabled={acting !== null}
          >
            {acting === order.id ? (
              <ActivityIndicator size="small" color={COLORS.lime} />
            ) : (
              <>
                <Ionicons name="bicycle" size={16} color={COLORS.lime} />
                <Text style={styles.primaryActionText}>Start Delivery</Text>
              </>
            )}
          </Pressable>
        ) : null}
        {canDeliver ? (
          <Pressable
            style={[styles.primaryAction, styles.deliverAction]}
            onPress={() => onAdvance(order)}
            disabled={acting !== null}
          >
            {acting === order.id ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <>
                <Ionicons name="checkmark-done" size={16} color={COLORS.white} />
                <Text style={[styles.primaryActionText, styles.deliverText]}>Mark Delivered</Text>
              </>
            )}
          </Pressable>
        ) : null}
        {order.status === 'Delivered' ? (
          <Text style={styles.doneText}>Delivered · {formatWhen(order.updatedAt)}</Text>
        ) : null}
      </View>
    </View>
  );
}

export function DriverHomeScreen() {
  const { user, driverProfile } = useAuth();
  const [orders, setOrders] = useState<CustomerOrder[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'requesting' | 'denied' | 'live' | 'off'>('idle');
  const [lastFix, setLastFix] = useState<{ at: number; lat: number; lng: number } | null>(null);
  const ordersRef = useRef<CustomerOrder[]>([]);

  const profile: DriverProfile | null = driverProfile;

  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeAssignedOrders(
      user.uid,
      (list) => {
        setOrders(list);
        ordersRef.current = list;
        setLoadError(null);
      },
      (error) => setLoadError(error.message)
    );
    return unsubscribe;
  }, [user]);

  // ── Real GPS stream (foreground) ──
  useEffect(() => {
    let watcher: Location.LocationSubscription | null = null;
    let cancelled = false;

    async function start() {
      setGpsStatus('requesting');
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      if (status !== 'granted') {
        setGpsStatus('denied');
        return;
      }
      watcher = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 10_000, // one fix every 10 s
          distanceInterval: 20, // …or every 20 m, whichever comes first
        },
        (position) => {
          setGpsStatus('live');
          const { latitude, longitude } = position.coords;
          setLastFix({ at: Date.now(), lat: latitude, lng: longitude });
          const targets = ordersRef.current.filter(
            (order) => order.status === 'Out for Delivery' || order.status === 'Preparing'
          );
          for (const order of targets) {
            void publishDriverLocation(order.orderId, latitude, longitude).catch(() => {
              // Rules block publishes to Delivered/Cancelled orders — harmless.
            });
          }
        }
      );
      setGpsStatus((current) => (current === 'requesting' ? 'live' : current));
    }

    void start();
    return () => {
      cancelled = true;
      watcher?.remove();
    };
  }, []);

  // Pause visual "live" flag when the app is backgrounded (watch keeps the
  // OS-level subscription but Android throttles it; the customer map simply
  // keeps the last published fix until the driver returns).
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background' && gpsStatus === 'live') setGpsStatus('off');
      if (state === 'active' && gpsStatus === 'off') setGpsStatus('live');
    });
    return () => subscription.remove();
  }, [gpsStatus]);

  const activeOrders = useMemo(
    () =>
      (orders ?? []).filter(
        (order) => order.status === 'Preparing' || order.status === 'Out for Delivery'
      ),
    [orders]
  );
  const doneToday = useMemo(
    () => (orders ?? []).filter((order) => order.status === 'Delivered').slice(0, 8),
    [orders]
  );

  async function advance(order: CustomerOrder) {
    const next = order.status === 'Preparing' ? 'Out for Delivery' : 'Delivered';
    if (next === 'Delivered') {
      Alert.alert('Confirm delivery', `Mark ${order.orderId} as delivered and collect ₹${order.total} cash?`, [
        { text: 'Not yet', style: 'cancel' },
        { text: 'Delivered', onPress: () => void doAdvance(order, next) },
      ]);
      return;
    }
    await doAdvance(order, next);
  }

  async function doAdvance(order: CustomerOrder, next: string) {
    setActing(order.id);
    try {
      await setDriverOrderStatus(order.orderId, next);
    } catch (error) {
      const message =
        typeof error === 'object' && error !== null && 'message' in error
          ? String((error as { message: unknown }).message).replace(/^.*?:\s*/, '')
          : 'Could not update the order. Please try again.';
      Alert.alert('Update failed', message.slice(0, 200));
    } finally {
      setActing(null);
    }
  }

  if (profile && profile.active === false) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <StatusBar style="dark" />
        <View style={styles.center}>
          <Ionicons name="pause-circle-outline" size={48} color={COLORS.amber} />
          <Text style={styles.emptyTitle}>Account paused</Text>
          <Text style={styles.emptyText}>
            Your driver account is currently disabled. Contact the restaurant admin.
          </Text>
          <Pressable style={styles.signOut} onPress={() => void logoutCustomer()}>
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="dark" />
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.badge}>
            <Ionicons name="bicycle" size={17} color={COLORS.lime} />
          </View>
          <View>
            <Text style={styles.headerName}>{profile?.name ?? 'Driver'}</Text>
            <Text style={styles.headerSub}>BHHOOKH BOX · Delivery</Text>
          </View>
        </View>
        <Pressable
          hitSlop={8}
          onPress={() => void logoutCustomer()}
          accessibilityLabel="Sign out"
        >
          <Ionicons name="log-out-outline" size={23} color={COLORS.textMuted} />
        </Pressable>
      </View>

      {/* GPS banner — real location only, honest states (§9) */}
      <View
        style={[
          styles.gpsBanner,
          gpsStatus === 'live' && styles.gpsLive,
          gpsStatus === 'denied' && styles.gpsDenied,
        ]}
      >
        <Ionicons
          name={gpsStatus === 'live' ? 'navigate' : gpsStatus === 'denied' ? 'warning-outline' : 'location-outline'}
          size={15}
          color={gpsStatus === 'denied' ? COLORS.danger : COLORS.limeDeep}
        />
        <Text style={styles.gpsText}>
          {gpsStatus === 'live' && lastFix
            ? `Live GPS on · ${lastFix.lat.toFixed(5)}, ${lastFix.lng.toFixed(5)} · last fix ${timeAgo(lastFix.at)}`
            : gpsStatus === 'live'
              ? 'Live GPS on — waiting for the first fix…'
              : gpsStatus === 'denied'
                ? 'Location permission denied — customers cannot see your position. Enable it in system settings.'
                : gpsStatus === 'requesting'
                  ? 'Requesting location permission…'
                  : 'GPS updates paused'}
        </Text>
      </View>

      {/* Orders */}
      {loadError ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={40} color={COLORS.danger} />
          <Text style={styles.emptyTitle}>Connection problem</Text>
          <Text style={styles.emptyText}>{loadError}</Text>
        </View>
      ) : orders === null ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.limeDeep} />
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionTitle}>Active Deliveries ({activeOrders.length})</Text>
          {activeOrders.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="hand-left-outline" size={30} color={COLORS.limeDeep} />
              <Text style={styles.emptyText}>
                No orders assigned right now. The admin assigns orders from the dashboard —
                they appear here instantly.
              </Text>
            </View>
          ) : (
            activeOrders.map((order) => (
              <DriverOrderCard key={order.id} order={order} acting={acting} onAdvance={(target) => void advance(target)} />
            ))
          )}

          {doneToday.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>Recently Delivered</Text>
              {doneToday.map((order) => (
                <View style={[styles.card, styles.doneCard]} key={order.id}>
                  <View style={styles.cardTop}>
                    <Text style={styles.orderId}>{order.orderId}</Text>
                    <Text style={styles.doneWhen}>{formatWhen(order.updatedAt)}</Text>
                  </View>
                  <Text style={styles.itemsLine} numberOfLines={1}>
                    ₹{order.total} collected · {order.items.map((item) => `${item.quantity}× ${item.name}`).join(', ')}
                  </Text>
                </View>
              ))}
            </>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  badge: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerName: { fontSize: 15.5, fontWeight: '900', color: COLORS.text },
  headerSub: { fontSize: 11.5, color: COLORS.textMuted, marginTop: 1 },
  gpsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: RADII.md,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  gpsLive: { backgroundColor: COLORS.limeSoft, borderColor: '#D9F0B4' },
  gpsDenied: { backgroundColor: COLORS.dangerSoft, borderColor: '#FECACA' },
  gpsText: { flex: 1, fontSize: 11.5, fontWeight: '600', color: COLORS.text },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 4,
  },
  card: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADII.lg,
    padding: 14,
    gap: 8,
    marginBottom: 12,
  },
  doneCard: { backgroundColor: COLORS.surface },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  orderId: { flex: 1, fontSize: 14, fontWeight: '800', color: COLORS.primary },
  statusChip: {
    borderRadius: RADII.pill,
    backgroundColor: COLORS.limeSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#D9F0B4',
  },
  statusChipLive: { backgroundColor: '#E0F2FE', borderColor: '#BAE6FD' },
  statusText: { fontSize: 11, fontWeight: '800', color: COLORS.primary },
  addressBlock: {
    backgroundColor: COLORS.surface,
    borderRadius: RADII.md,
    padding: 10,
    gap: 4,
  },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  addressText: { flex: 1, fontSize: 12.5, fontWeight: '800', color: COLORS.text },
  addressLine: { fontSize: 12.5, color: COLORS.textMuted, lineHeight: 17 },
  addressActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1.3,
    borderColor: COLORS.primary,
    borderRadius: RADII.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: COLORS.white,
  },
  callText: { fontSize: 11.5, fontWeight: '800', color: COLORS.primary },
  codChip: {
    borderRadius: RADII.pill,
    backgroundColor: COLORS.limeSoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#D9F0B4',
  },
  codText: { fontSize: 11.5, fontWeight: '800', color: COLORS.limeDeep },
  itemsLine: { fontSize: 12.5, color: COLORS.textMuted },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  primaryAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: COLORS.primary,
    borderRadius: RADII.pill,
    paddingVertical: 12,
  },
  deliverAction: { backgroundColor: COLORS.limeDeep },
  deliverText: { color: COLORS.white },
  primaryActionText: { color: COLORS.lime, fontWeight: '800', fontSize: 13.5 },
  doneText: { fontSize: 12.5, color: COLORS.textMuted, fontWeight: '600' },
  doneWhen: { fontSize: 11.5, color: COLORS.textMuted },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 6 },
  emptyCard: {
    borderWidth: 1.4,
    borderStyle: 'dashed',
    borderColor: COLORS.input,
    borderRadius: RADII.lg,
    padding: 22,
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.surface,
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text, marginTop: 8 },
  emptyText: { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', lineHeight: 19 },
  signOut: {
    marginTop: 14,
    borderWidth: 1.4,
    borderColor: COLORS.primary,
    borderRadius: RADII.pill,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  signOutText: { color: COLORS.primary, fontWeight: '800', fontSize: 13 },
});
