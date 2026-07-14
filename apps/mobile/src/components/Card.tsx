import React, { PropsWithChildren } from 'react';
import { StyleSheet, View, ViewProps, ViewStyle } from 'react-native';
import { theme } from '../theme';

type CardProps = PropsWithChildren<{ style?: ViewStyle; onLayout?: ViewProps['onLayout'] }>;

// Flat card: no border, no shadow - separated from the background purely by the
// surface/bg color contrast.
export function Card({ children, style, onLayout }: CardProps) {
  return (
    <View style={[styles.card, style]} onLayout={onLayout}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.md,
  },
});

export default Card;
