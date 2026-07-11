import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { theme } from '../theme';

type PillProps = {
  label: string;
  backgroundColor: string;
  textColor: string;
  style?: ViewStyle;
};

// Small solid label chip - used for the header XP badge and the accent "tag" on the
// announcement card. Callers must pass theme colors, never a raw hex value.
export function Pill({ label, backgroundColor, textColor, style }: PillProps) {
  return (
    <View style={[styles.pill, { backgroundColor }, style]}>
      <Text style={[styles.label, { color: textColor }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: theme.radii.sm,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    alignSelf: 'flex-start',
  },
  label: {
    ...theme.type.caption,
    fontFamily: theme.fonts.bodyMedium,
  },
});

export default Pill;
