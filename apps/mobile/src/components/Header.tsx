import React, { PropsWithChildren } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Avatar } from './Avatar';
import { theme } from '../theme';

// brilla-header-icon-256.png is 256x267 - keep that aspect ratio at any height.
const ICON_ASPECT = 256 / 267;
const ICON_HEIGHT = 30;

type HeaderProps = PropsWithChildren<{
  avatarLabel?: string;
  avatarUrl?: string;
  right?: React.ReactNode;
}>;

// Shared brand header - the small logo mark plus the user avatar on the left, with an
// optional slot (e.g. XP/coin badges) on the right. Used at the top of every tab screen.
export function Header({ avatarLabel, avatarUrl, right }: HeaderProps) {
  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <Image
          source={require('../../assets/images/brilla-header-icon-256.png')}
          style={{ height: ICON_HEIGHT, width: ICON_HEIGHT * ICON_ASPECT }}
          resizeMode="contain"
        />
        {avatarLabel && (
          <Avatar label={avatarLabel} source={avatarUrl ? { uri: avatarUrl } : undefined} size={ICON_HEIGHT} />
        )}
      </View>
      <View style={styles.right}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
});

export default Header;
