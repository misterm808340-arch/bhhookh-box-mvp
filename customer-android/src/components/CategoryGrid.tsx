import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADII } from '../theme';
import { FoodImage, safeIconName } from './FoodImage';
import type { Category } from '../types';

/**
 * "What would you like to eat?" — every enabled category as a tap-friendly
 * tile (icon + name), rendered straight from Firestore. The first tile is
 * the implicit "All" pseudo-category (categoryId === null).
 */
interface CategoryGridProps {
  categories: Category[];
  /** null = All. */
  selected: string | null;
  counts: Map<string, number>;
  onSelect: (categoryId: string | null) => void;
}

export function CategoryGrid({ categories, selected, counts, onSelect }: CategoryGridProps) {
  return (
    <View style={styles.grid}>
      <CategoryTile
        label="All"
        icon="restaurant-outline"
        emoji=""
        imageUrl=""
        count={categories.reduce((sum, category) => sum + (counts.get(category.id) ?? 0), 0)}
        active={selected === null}
        onPress={() => onSelect(null)}
      />
      {categories.map((category) => (
        <CategoryTile
          key={category.id}
          label={category.name}
          icon={category.icon}
          emoji={category.emoji}
          imageUrl={category.imageUrl}
          count={counts.get(category.id) ?? 0}
          active={selected === category.id}
          onPress={() => onSelect(category.id)}
        />
      ))}
    </View>
  );
}

interface CategoryTileProps {
  label: string;
  icon: string;
  emoji: string;
  imageUrl: string;
  count: number;
  active: boolean;
  onPress: () => void;
}

function CategoryTile({ label, icon, emoji, imageUrl, count, active, onPress }: CategoryTileProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.tile, active && styles.tileActive, pressed && { opacity: 0.8 }]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${label} category, ${count} items`}
    >
      <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
        {imageUrl ? (
          <FoodImage uri={imageUrl} icon={icon} emoji={emoji} style={styles.image} iconSize={22} />
        ) : (
          <Ionicons name={safeIconName(icon)} size={24} color={active ? COLORS.primary : COLORS.limeDeep} />
        )}
      </View>
      <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.count, active && styles.labelActive]}>{count}</Text>
    </Pressable>
  );
}

const TILE_GAP = 8;

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: TILE_GAP,
  },
  tile: {
    flexGrow: 1,
    flexBasis: '30%',
    maxWidth: '47%',
    backgroundColor: COLORS.card,
    borderWidth: 1.2,
    borderColor: COLORS.border,
    borderRadius: RADII.lg,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    gap: 5,
  },
  tileActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.limeSoft,
    borderWidth: 1.6,
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  iconWrapActive: {
    backgroundColor: COLORS.lime,
  },
  image: {
    width: 46,
    height: 46,
    borderRadius: 15,
  },
  label: {
    fontSize: 11.5,
    fontWeight: '700',
    color: COLORS.text,
    maxWidth: '100%',
  },
  count: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginTop: -3,
  },
  labelActive: {
    color: COLORS.primary,
  },
});
