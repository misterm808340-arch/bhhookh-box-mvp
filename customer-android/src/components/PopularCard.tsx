import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADII } from '../theme';
import { VegMark } from './PrimaryButton';
import type { FoodItem } from '../types';

interface PopularCardProps {
  item: FoodItem;
  onAdd: () => void;
}

/** Horizontal "popular near you" card. */
export function PopularCard({ item, onAdd }: PopularCardProps) {
  return (
    <View style={styles.card}>
      <Image source={item.image} style={styles.image} />
      <View style={styles.badgeRow}>
        <View style={styles.ratingBadge}>
          <Ionicons name="star" size={10} color={COLORS.white} />
          <Text style={styles.ratingText}>{item.rating.toFixed(1)}</Text>
        </View>
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
        <Text style={styles.price}>₹{item.price}</Text>
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
