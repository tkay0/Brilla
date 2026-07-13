import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Avatar } from './Avatar';
import { Pill } from './Pill';
import { theme } from '../theme';

type HeaderStatusProps = {
  name: string;
  avatarUrl?: string;
  xp: number;
  coins: number;
};

// Right-hand side of the shared Header on Home/Quiz/Leaderboard: user avatar, XP badge,
// coin badge - in that order.
export function HeaderStatus({ name, avatarUrl, xp, coins }: HeaderStatusProps) {
  return (
    <View style={styles.row}>
      <Avatar label={name} source={avatarUrl ? { uri: avatarUrl } : undefined} size={32} />
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
