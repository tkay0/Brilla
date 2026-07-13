import React, { useState } from 'react';
import { Image, ImageSourcePropType, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { theme } from '../theme';

type AvatarProps = {
  label: string;
  source?: ImageSourcePropType;
  size?: number;
  backgroundColor?: string;
  textColor?: string;
  style?: ViewStyle;
};

function initials(label: string) {
  return label
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

// Circle avatar: renders `source` if provided, falling back to initials if there's no
// source or the image fails to load (e.g. a broken avatarUrl or missing crest asset).
export function Avatar({
  label,
  source,
  size = 36,
  backgroundColor = theme.colors.primary,
  textColor = theme.colors.surface,
  style,
}: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const showImage = !!source && !failed;

  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor },
        style,
      ]}
    >
      {showImage ? (
        <Image
          source={source}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          resizeMode="cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <Text style={[styles.label, { fontSize: size * 0.38, color: textColor }]}>{initials(label)}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  label: {
    fontFamily: theme.fonts.bodyMedium,
  },
});

export default Avatar;
