import React, { useEffect, useRef } from 'react';
import { Animated, StyleProp, ViewStyle } from 'react-native';
import { theme } from '../theme';

type ShimmerBlockProps = {
  width?: number | `${number}%`;
  height: number;
  style?: StyleProp<ViewStyle>;
  borderRadius?: number;
};

export function ShimmerBlock({
  width = '100%',
  height,
  style,
  borderRadius = theme.radii.md,
}: ShimmerBlockProps) {
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.95,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.45,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: theme.colors.surface,
          opacity,
        },
        style,
      ]}
    />
  );
}

export default ShimmerBlock;
