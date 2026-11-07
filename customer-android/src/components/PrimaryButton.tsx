import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { COLORS, RADII } from '../theme';

interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'danger' | 'outline';
  style?: ViewStyle;
  height?: number;
}

/** Brand pill button used for all primary actions. */
export function PrimaryButton({
  title,
  onPress,
  disabled = false,
  loading = false,
  variant = 'primary',
  style,
  height = 54,
}: PrimaryButtonProps) {
  const isDisabled = disabled || loading;
  const background =
    variant === 'danger' ? COLORS.danger : variant === 'outline' ? COLORS.white : COLORS.primary;
  const textColor = variant === 'outline' ? COLORS.primary : COLORS.white;
  const borderColor = variant === 'outline' ? COLORS.border : 'transparent';

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: background, borderColor, height, opacity: isDisabled ? 0.55 : pressed ? 0.88 : 1 },
        style,
      ]}
    >
      {loading && <ActivityIndicator color={textColor} style={{ marginRight: 10 }} />}
      <Text style={[styles.title, { color: textColor }]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADII.md,
    borderWidth: 1.5,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});

/** Small green/red square used as the Indian veg / non-veg indicator. */
export function VegMark({ isVeg }: { isVeg: boolean }) {
  const color = isVeg ? '#16A34A' : '#B91C1C';
  return (
    <View
      style={{
        width: 14,
        height: 14,
        borderRadius: 3,
        borderWidth: 1.6,
        borderColor: color,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
    </View>
  );
}
