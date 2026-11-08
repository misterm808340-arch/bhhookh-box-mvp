import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADII } from '../theme';

/**
 * Product / category image with graceful fallback:
 *   remote imageUrl → <Image>, on load error → icon tile
 *   no imageUrl    → icon tile (Ionicons name, or emoji, or fork icon)
 */
interface FoodImageProps {
  uri: string;
  icon: string;
  emoji?: string;
  style: { width: number | `${number}%`; height: number; borderRadius?: number };
  iconSize?: number;
}

/** Small allow-list of icons known to exist in Ionicons (guards bad admin input). */
const KNOWN_ICONS = new Set([
  'restaurant', 'restaurant-outline', 'fast-food', 'fast-food-outline', 'pizza',
  'pizza-outline', 'flame', 'flame-outline', 'albums', 'albums-outline', 'cafe',
  'cafe-outline', 'pint', 'pint-outline', 'water', 'water-outline', 'sparkles',
  'sparkles-outline', 'ice-cream', 'ice-cream-outline', 'nutrition', 'nutrition-outline',
  'leaf', 'leaf-outline', 'fish', 'fish-outline', 'egg', 'egg-outline', 'gift',
  'gift-outline', 'star', 'star-outline', 'heart', 'heart-outline', 'diamond',
  'diamond-outline', 'cart', 'cart-outline', 'grid', 'grid-outline', 'beer',
  'beer-outline', 'wine', 'wine-outline', 'flash', 'flash-outline',
  'game-controller', 'game-controller-outline', 'musical-notes', 'musical-notes-outline',
]);

/** Returns the icon name if it is known to exist in Ionicons, else a safe fork icon. */
export function safeIconName(icon: string): keyof typeof Ionicons.glyphMap {
  return (KNOWN_ICONS.has(icon) ? icon : 'restaurant-outline') as keyof typeof Ionicons.glyphMap;
}

export function FoodImage({ uri, icon, emoji, style, iconSize = 34 }: FoodImageProps) {
  const [failed, setFailed] = useState(false);
  const safeIcon = safeIconName(icon);

  if (uri && !failed) {
    return (
      <Image
        source={{ uri }}
        style={[style, styles.image]}
        onError={() => setFailed(true)}
        accessibilityIgnoresInvertColors
      />
    );
  }
  return (
    <View style={[style, styles.tile]}>
      {emoji ? (
        <Text style={[styles.emoji, { fontSize: iconSize }]}>{emoji}</Text>
      ) : (
        <Ionicons name={safeIcon} size={iconSize} color={COLORS.limeDeep} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    backgroundColor: COLORS.surface,
  },
  tile: {
    backgroundColor: COLORS.limeSoft,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADII.md,
  },
  emoji: {
    textAlign: 'center',
  },
});
