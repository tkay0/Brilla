import React, { PropsWithChildren } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { theme } from '../theme';

// brilla-header-icon-256.png is 256x267 - keep that aspect ratio at any height.
const ICON_ASPECT = 256 / 267;
const ICON_HEIGHT = 30;

type HeaderProps = PropsWithChildren<{ right?: React.ReactNode }>;

// Shared brand header - the small logo mark on the left, with an optional slot
// (e.g. the XP pill on Home) on the right. Used at the top of every tab screen.
export function Header({ right }: HeaderProps) {
  return (
    <View style={styles.row}>
      <Image
        source={require('../../assets/images/brilla-header-icon-256.png')}
        style={{ height: ICON_HEIGHT, width: ICON_HEIGHT * ICON_ASPECT }}
        resizeMode="contain"
      />
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});

export default Header;
