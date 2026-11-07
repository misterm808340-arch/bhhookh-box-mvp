import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADII } from '../theme';

interface QtyStepperProps {
  quantity: number;
  onIncrement: () => void;
  onDecrement: () => void;
  /** 'compact' fits inside food cards, 'large' for the cart screen. */
  size?: 'compact' | 'large';
}

const SIZES = {
  compact: { height: 32, icon: 15, minTextWidth: 26, fontSize: 13.5, radius: RADII.sm },
  large: { height: 40, icon: 19, minTextWidth: 34, fontSize: 15.5, radius: RADII.md },
} as const;

export function QtyStepper({ quantity, onIncrement, onDecrement, size = 'compact' }: QtyStepperProps) {
  const dimensions = SIZES[size];
  return (
    <View
      style={[styles.container, { height: dimensions.height, borderRadius: dimensions.radius }]}
    >
      <Pressable
        onPress={onDecrement}
        hitSlop={10}
        style={({ pressed }) => [
          styles.square,
          { width: dimensions.height },
          pressed && { opacity: 0.7 },
        ]}
        accessibilityLabel="Decrease quantity"
      >
        <Ionicons name="remove" size={dimensions.icon} color={COLORS.white} />
      </Pressable>
      <Text
        style={[
          styles.quantity,
          { minWidth: dimensions.minTextWidth, fontSize: dimensions.fontSize },
        ]}
      >
        {quantity}
      </Text>
      <Pressable
        onPress={onIncrement}
        hitSlop={10}
        style={({ pressed }) => [
          styles.square,
          { width: dimensions.height },
          pressed && { opacity: 0.7 },
        ]}
        accessibilityLabel="Increase quantity"
      >
        <Ionicons name="add" size={dimensions.icon} color={COLORS.white} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    overflow: 'hidden',
  },
  square: {
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantity: {
    color: COLORS.white,
    fontWeight: '800',
    textAlign: 'center',
  },
});
