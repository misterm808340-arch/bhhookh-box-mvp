import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADII } from '../theme';
import { QtyStepper } from './QtyStepper';
import type { CartLine } from '../types';

interface CartLineRowProps {
  line: CartLine;
  onIncrement: () => void;
  onDecrement: () => void;
  onRemove: () => void;
}

export function CartLineRow({ line, onIncrement, onDecrement, onRemove }: CartLineRowProps) {
  return (
    <View style={styles.row}>
      <Image source={line.item.image} style={styles.image} />
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {line.item.name}
        </Text>
        <Text style={styles.unitPrice}>₹{line.item.effectivePrice} each</Text>
        <View style={styles.controls}>
          <QtyStepper
            quantity={line.quantity}
            onIncrement={onIncrement}
            onDecrement={onDecrement}
            size="large"
          />
          <Pressable
            onPress={onRemove}
            hitSlop={10}
            style={({ pressed }) => [styles.remove, pressed && { opacity: 0.7 }]}
            accessibilityLabel={`Remove ${line.item.name} from cart`}
          >
            <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
          </Pressable>
        </View>
      </View>
      <Text style={styles.lineTotal}>₹{line.item.effectivePrice * line.quantity}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADII.lg,
    padding: 12,
  },
  image: {
    width: 62,
    height: 62,
    borderRadius: RADII.sm,
    backgroundColor: COLORS.surface,
  },
  info: {
    flex: 1,
    gap: 4,
  },
  name: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
  },
  unitPrice: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 2,
  },
  remove: {
    width: 40,
    height: 40,
    borderRadius: RADII.sm,
    borderWidth: 1.2,
    borderColor: '#FECACA',
    backgroundColor: COLORS.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lineTotal: {
    fontSize: 15.5,
    fontWeight: '800',
    color: COLORS.primary,
  },
});
