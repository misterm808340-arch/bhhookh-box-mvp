import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useCatalog } from '../context/CatalogContext';
import { subscribeMyOrders } from '../lib/orders';
import { COLORS, RADII } from '../theme';
import type { CustomerOrder } from '../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';

type ReorderScreenProps = NativeStackScreenProps<RootStackParamList, 'Reorder'>;

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

/**
 * One-tap Reorder (§3): resolves every item of a delivered order against the
 * CURRENT Firestore menu — availability and today's price are re-validated,
 * and anything unavailable is skipped (the immutable order snapshot is never
 * re-priced, the fresh menu is what you pay).
 */
export function ReorderScreen({ navigation }: ReorderScreenProps) {
  const { user } = useAuth();
  const { products, loading: catalogLoading } = useCatalog();
  const { addItem } = useCart();
  const [orders, setOrders] = useState<CustomerOrder[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeMyOrders(
      user.uid,
      (list) => setOrders(list.filter((order) => order.status === 'Delivered')),
      (error) => setLoadError(error.message)
    );
    return unsubscribe;
  }, [user]);

  const delivered = useMemo(() => orders ?? [], [orders]);

  function reorder(order: CustomerOrder) {
    if (busy || catalogLoading) return;
    let added = 0;
    const skipped: string[] = [];
    for (const item of order.items) {
      const product = products.find((candidate) => candidate.id === item.productId);
      if (!product || !product.available) {
        skipped.push(item.name);
        continue;
      }
      const cappedQuantity =
        product.stock !== null ? Math.min(item.quantity, product.stock) : item.quantity;
      if (cappedQuantity <= 0) {
        skipped.push(item.name);
        continue;
      }
      for (let index = 0; index < cappedQuantity; index += 1) addItem(product);
      added += cappedQuantity;
    }

    if (added === 0) {
      Alert.alert(
        'Nothing to re-order',
        skipped.length > 0
          ? `These items are currently unavailable: ${skipped.join(', ')}.`
          : 'The items from this order are no longer on the menu.'
      );
      return;
    }

    const note = skipped.length > 0 ? ` Skipped (unavailable): ${skipped.join(', ')}.` : '';
    Alert.alert('Added to cart', `${added} item${added === 1 ? '' : 's'} from ${order.orderId}.${note}`, [
      { text: 'Keep Browsing', style: 'cancel' },
      { text: 'Go to Cart', onPress: () => navigation.navigate('Cart') },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={24} color={COLORS.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>Reorder</Text>
        <View style={styles.headerSpacer} />
      </View>

      {orders === null ? (
        <View style={styles.center}>
          {loadError ? (
            <>
              <Ionicons name="cloud-offline-outline" size={40} color={COLORS.danger} />
              <Text style={styles.emptyTitle}>Could not load orders</Text>
              <Text style={styles.emptyText}>{loadError}</Text>
            </>
          ) : (
            <ActivityIndicator size="large" color={COLORS.limeDeep} />
          )}
        </View>
      ) : delivered.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="repeat-outline" size={44} color={COLORS.limeDeep} />
          <Text style={styles.emptyTitle}>No delivered orders yet</Text>
          <Text style={styles.emptyText}>
            Once an order is delivered you can repeat it here with one tap.
          </Text>
        </View>
      ) : (
        <FlatList
          data={delivered}
          keyExtractor={(order) => order.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.orderId}>{item.orderId}</Text>
                  <Text style={styles.when}>{formatWhen(item.createdAt)}</Text>
                </View>
                <Text style={styles.total}>₹{item.total}</Text>
              </View>
              <Text style={styles.itemsLine} numberOfLines={2}>
                {item.items.map((line) => `${line.quantity}× ${line.name}`).join(', ')}
              </Text>
              <Pressable
                style={[styles.reorderButton, busy === item.id && styles.reorderBusy]}
                onPress={() => reorder(item)}
                disabled={busy !== null || catalogLoading}
              >
                {busy === item.id ? (
                  <ActivityIndicator size="small" color={COLORS.lime} />
                ) : (
                  <>
                    <Ionicons name="repeat" size={15} color={COLORS.lime} />
                    <Text style={styles.reorderText}>Reorder Items</Text>
                  </>
                )}
              </Pressable>
            </View>
          )}
        />
      )}
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
  list: { padding: 16, paddingBottom: 24, gap: 12 },
  card: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADII.lg,
    padding: 14,
    gap: 8,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  orderId: { fontSize: 14, fontWeight: '800', color: COLORS.primary },
  when: { fontSize: 11.5, color: COLORS.textMuted, marginTop: 1 },
  total: { fontSize: 15.5, fontWeight: '900', color: COLORS.primary },
  itemsLine: { fontSize: 13, color: COLORS.textMuted },
  reorderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: COLORS.primary,
    borderRadius: RADII.pill,
    paddingVertical: 10,
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
  },
  reorderBusy: { opacity: 0.6 },
  reorderText: { color: COLORS.lime, fontWeight: '800', fontSize: 12.5 },
});
