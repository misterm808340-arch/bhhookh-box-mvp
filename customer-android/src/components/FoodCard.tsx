import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADII } from '../theme';
import { VegMark } from './PrimaryButton';
import { QtyStepper } from './QtyStepper';
import { FoodImage } from './FoodImage';
import type { FoodItem } from '../types';

interface FoodCardProps {
  item: FoodItem;
  quantity: number;
  onAdd: () => void;
  onIncrement: () => void;
  onDecrement: () => void;
}

/** Menu list row: image on the left, details + price + add/stepper on the right. */
export function FoodCard({ item, quantity, onAdd, onIncrement, onDecrement }: FoodCardProps) {
  // Discount comes pre-computed from Firestore mapping (offer-window aware).
  const off = item.discountPercent > 0 ? item.discountPercent : null;
  const outOfStock = item.stock !== null && item.stock <= 0;
  return (
    <View style={styles.card}>
      <FoodImage
        uri={item.imageUrl}
        icon={item.categoryIcon}
        style={styles.image}
        iconSize={30}
      />
      <View style={styles.info}>
        <View style={styles.titleRow}>
          <VegMark isVeg={item.isVeg} />
          <Text style={styles.name} numberOfLines={1}>
            {item.name}
          </Text>
          {item.popular ? <Ionicons name="flame" size={13} color="#F59E0B" /> : null}
        </View>
        <Text style={styles.description} numberOfLines={2}>
          {item.description}
        </Text>
        <View style={styles.metaRow}>
          <Ionicons name="star" size={12} color="#F59E0B" />
          <Text style={styles.meta}>{item.rating.toFixed(1)}</Text>
          <Text style={styles.dot}>·</Text>
          <Ionicons name="time-outline" size={12} color={COLORS.textMuted} />
          <Text style={styles.meta}>{item.prepTime}</Text>
        </View>
        <View style={styles.bottomRow}>
          <View style={styles.priceRow}>
            <Text style={styles.price}>₹{item.effectivePrice}</Text>
            {off !== null ? (
              <>
                <Text style={styles.mrp}>₹{item.mrp}</Text>
                <View style={styles.offBadge}>
                  <Text style={styles.offText}>{off}% OFF</Text>
                </View>
              </>
            ) : null}
          </View>
          {outOfStock ? (
            <View style={styles.stockChip}>
              <Text style={styles.stockText}>Out of stock</Text>
            </View>
          ) : quantity === 0 ? (
            <Pressable
              onPress={onAdd}
              hitSlop={8}
              style={({ pressed }) => [styles.addButton, pressed && { opacity: 0.85 }]}
              accessibilityLabel={`Add ${item.name} to cart`}
            >
              <Ionicons name="add" size={16} color={COLORS.primaryDark} />
              <Text style={styles.addLabel}>ADD</Text>
            </Pressable>
          ) : (
            <QtyStepper
              quantity={quantity}
              onIncrement={onIncrement}
              onDecrement={onDecrement}
            />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADII.lg,
    padding: 10,
    marginHorizontal: 16,
    marginVertical: 6,
    // Subtle premium shadow
    shadowColor: '#0B3D2E',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  image: {
    width: 96,
    height: 96,
    borderRadius: RADII.md,
    backgroundColor: COLORS.surface,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  mrp: {
    fontSize: 12.5,
    fontWeight: '600',
    color: COLORS.textMuted,
    textDecorationLine: 'line-through',
  },
  offBadge: {
    backgroundColor: COLORS.lime,
    borderRadius: RADII.pill,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  offText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.primaryDark,
  },
  info: {
    flex: 1,
    gap: 3,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  name: {
    flex: 1,
    fontSize: 15.5,
    fontWeight: '800',
    color: COLORS.text,
  },
  description: {
    fontSize: 12.5,
    lineHeight: 17,
    color: COLORS.textMuted,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  meta: {
    fontSize: 11.5,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  dot: {
    color: COLORS.textMuted,
    fontWeight: '700',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  price: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.primary,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: COLORS.lime,
    borderRadius: RADII.sm,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  stockChip: {
    borderRadius: RADII.sm,
    borderWidth: 1.4,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  stockText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textMuted,
  },
  addLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.primaryDark,
    letterSpacing: 0.4,
  },
});
