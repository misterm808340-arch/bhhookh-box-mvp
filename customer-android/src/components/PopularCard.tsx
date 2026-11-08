import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADII } from '../theme';
import { VegMark } from './PrimaryButton';
import { FoodImage } from './FoodImage';
import { discountPercent } from '../lib/catalog';
import type { FoodItem } from '../types';

interface PopularCardProps {
  item: FoodItem;
  onAdd: () => void;
}

/** Horizontal "popular near you" card. */
export function PopularCard({ item, onAdd }: PopularCardProps) {
  const off = discountPercent(item.price, item.mrp);
  return (
    <View style={styles.card}>
      <FoodImage uri={item.imageUrl} icon={item.categoryIcon} style={styles.image} iconSize={30} />
      <View style={styles.badgeRow}>
        {off !== null ? (
          <View style={styles.offBadge}>
            <Text style={styles.offText}>{off}% OFF</Text>
          </View>
        ) : (
          <View style={styles.ratingBadge}>
            <Ionicons name="star" size={10} color={COLORS.white} />
            <Text style={styles.ratingText}>{item.rating.toFixed(1)}</Text>
          </View>
        )}
      </View>
      <Pressable
        onPress={onAdd}
        hitSlop={8}
        style={({ pressed }) => [styles.addButton, pressed && { opacity: 0.85 }]}
        accessibilityLabel={`Add ${item.name} to cart`}
      >
        <Ionicons name="add" size={16} color={COLORS.primaryDark} />
      </Pressable>
      <View style={styles.footer}>
        <View style={styles.nameRow}>
          <VegMark isVeg={item.isVeg} />
          <Text style={styles.name} numberOfLines={1}>
            {item.name}
          </Text>
        </View>
        <View style={styles.priceRow}>
          <Text style={styles.price}>₹{item.price}</Text>
          {item.mrp !== null ? <Text style={styles.mrp}>₹{item.mrp}</Text> : null}
        </View>
      </View>
    </View>
  );
}

const CARD_WIDTH = 170;

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADII.lg,
    padding: 9,
    shadowColor: '#0B3D2E',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  image: {
    width: '100%',
    height: 110,
    borderRadius: RADII.md,
    backgroundColor: COLORS.surface,
  },
  badgeRow: {
    position: 'absolute',
    top: 15,
    left: 15,
    flexDirection: 'row',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(11, 61, 46, 0.85)',
    borderRadius: RADII.pill,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  ratingText: {
    color: COLORS.white,
    fontSize: 10.5,
    fontWeight: '800',
  },
  offBadge: {
    backgroundColor: COLORS.lime,
    borderRadius: RADII.pill,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  offText: {
    color: COLORS.primaryDark,
    fontSize: 10,
    fontWeight: '800',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  mrp: {
    fontSize: 11.5,
    fontWeight: '600',
    color: COLORS.textMuted,
    textDecorationLine: 'line-through',
  },
  addButton: {
    position: 'absolute',
    right: 15,
    bottom: 62,
    width: 32,
    height: 32,
    borderRadius: RADII.sm,
    backgroundColor: COLORS.lime,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  footer: {
    paddingTop: 8,
    gap: 3,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '800',
    color: COLORS.text,
  },
  price: {
    fontSize: 14.5,
    fontWeight: '800',
    color: COLORS.primary,
  },
});
