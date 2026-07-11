import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme';

type Props = {
  secondsLeft: number;
  totalSeconds: number;
};

// Depletes left-to-right over the round's duration - green for the first ~60% of time,
// orange for the next ~25%, red for the final ~15% as the deadline closes in. The seconds
// label next to it shares the same fraction, so both move in lockstep every tick.
export function TimerBar({ secondsLeft, totalSeconds }: Props) {
  const remainingFraction = Math.max(0, Math.min(1, secondsLeft / totalSeconds));

  let fillColor: string = theme.colors.success;
  if (remainingFraction <= 0.15) {
    fillColor = theme.colors.accent;
  } else if (remainingFraction <= 0.4) {
    fillColor = theme.colors.warning;
  }

  return (
    <View style={styles.container}>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${remainingFraction * 100}%`, backgroundColor: fillColor }]} />
      </View>
      <Text style={[styles.label, { color: fillColor }]}>{secondsLeft}s</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  track: {
    flex: 1,
    height: 8,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.surface,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: theme.radii.sm,
  },
  label: {
    ...theme.type.bodyMedium,
    minWidth: 28,
    textAlign: 'right',
  },
});
