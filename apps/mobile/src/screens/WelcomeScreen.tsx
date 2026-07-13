import React from 'react';
import { Image, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Svg, { ClipPath, Defs, Image as SvgImage, Path } from 'react-native-svg';
import { Button } from '../components/Button';
import { theme } from '../theme';
import type { AuthStackParamList } from '../lib/AuthStack';

// brilla-header-icon-256.png is 256x267; brilla-logo-lockup-1200.png is 1200x474.
const BADGE_ICON_ASPECT = 256 / 267;
const LOCKUP_ASPECT = 1200 / 474;

// Prototype viewBox is 340x320: full-height left edge rounded into a diagonal rising to a
// shorter right edge. heroHeight is always width*(320/340), so x and y share one scale factor -
// safe to fillet in prototype space and scale the whole arc uniformly.
//
// The corner is a true circular fillet (not an approximated quadratic curve) tangent to both
// the diagonal (340,230)->(0,309.33) and the vertical left edge, radius 36 at prototype scale.
function heroClipPath(width: number, height: number) {
  const s = width / 340;
  const x = (v: number) => v * s;
  const y = (v: number) => v * s;
  return `M${x(0)},${y(0)} L${x(340)},${y(0)} L${x(340)},${y(230)} L${x(44)},${y(299)} A${x(36)},${y(36)} 0 0,1 ${x(0)},${y(264)} Z`;
}

export default function WelcomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const { width } = useWindowDimensions();
  const heroHeight = width * (320 / 340);
  const badgeSize = width * (72 / 340);
  const badgeOverlap = width * (30 / 340);
  const lockupWidth = width - theme.spacing.lg * 2;
  const lockupHeight = lockupWidth / LOCKUP_ASPECT;

  return (
    <View style={styles.root}>
      <View style={{ width, height: heroHeight }}>
        <Svg width={width} height={heroHeight}>
          <Defs>
            <ClipPath id="heroClip">
              <Path d={heroClipPath(width, heroHeight)} />
            </ClipPath>
          </Defs>
          <SvgImage
            href={require('../../assets/images/quiz-boys.jpg')}
            width={width}
            height={heroHeight}
            preserveAspectRatio="xMidYMid slice"
            clipPath="url(#heroClip)"
          />
        </Svg>
      </View>

      <View style={[styles.badgeWrap, { marginTop: -badgeOverlap }]}>
        <View style={[styles.badgeBackdrop, { width: badgeSize, height: badgeSize, borderRadius: badgeSize / 2 }]}>
          <Image
            source={require('../../assets/images/brilla-header-icon-256.png')}
            style={{ width: badgeSize * 0.82, height: (badgeSize * 0.82) / BADGE_ICON_ASPECT }}
            resizeMode="contain"
          />
        </View>
      </View>

      <SafeAreaView style={styles.content} edges={['bottom']}>
        <Image
          source={require('../../assets/images/brilla-logo-lockup-1200.png')}
          style={{ width: lockupWidth, height: lockupHeight, alignSelf: 'center' }}
          resizeMode="contain"
        />
        <Text style={styles.description}>
          Practice real NSMQ questions, race the clock, and climb the leaderboard with students from schools across Ghana.
        </Text>
        <View style={styles.buttons}>
          <Button
            label="Get Started"
            onPress={() => navigation.navigate('Register')}
            style={{ borderRadius: theme.radii.sm }}
          />
          <Button
            label="Log In"
            variant="secondary"
            onPress={() => navigation.navigate('Login')}
            style={{ borderRadius: theme.radii.sm }}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  badgeWrap: { alignItems: 'center' },
  badgeBackdrop: {
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  description: { ...theme.type.body, color: theme.colors.inkMuted, textAlign: 'center' },
  buttons: {
    marginTop: 'auto',
    marginBottom: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
});
