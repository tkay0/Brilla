import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Pill } from './Pill';
import { theme } from '../theme';

type HeaderStatusProps = {
  xp: number;
  coins: number;
};

// Right-hand side of the shared Header on Home/Quiz/Leaderboard: XP badge, coin badge.
// The user avatar lives in the Header itself, next to the brand logo on the left.
export function HeaderStatus({ xp, coins }: HeaderStatusProps) {
  return (
    <View style={styles.row}>
      <Pill label={`${xp.toLocaleString('en-US')} XP`} backgroundColor={theme.colors.primary} textColor={theme.colors.surface} />
      <Pill label={`🪙 ${coins}`} backgroundColor={theme.colors.surface} textColor={theme.colors.ink} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
});

export default HeaderStatus;
