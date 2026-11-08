import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADII } from '../theme';
import { useCart } from '../context/CartContext';

interface CartBarProps {
  onPress: () => void;
}

/** Floating "view cart" bar (Swiggy-style) shown whenever the cart has items. */
export function CartBar({ onPress }: CartBarProps) {
  const { itemCount, total } = useCart();
  if (itemCount === 0) return null;

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.bar, pressed && { opacity: 0.92 }]}
        accessibilityLabel="Open cart"
      >
        <View style={styles.left}>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{itemCount}</Text>
          </View>
          <Text style={styles.totalText}>₹{total}</Text>
        </View>
        <View style={styles.right}>
          <Text style={styles.ctaText}>View Cart</Text>
          <Ionicons name="arrow-forward" size={16} color={COLORS.primaryDark} />
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.lime,
    borderRadius: RADII.lg,
    paddingVertical: 13,
    paddingHorizontal: 16,
    shadowColor: '#0B3D2E',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  countBadge: {
    minWidth: 26,
    height: 26,
    borderRadius: RADII.pill,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  countText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '800',
  },
  totalText: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.primaryDark,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  ctaText: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.primaryDark,
    letterSpacing: 0.2,
  },
});
