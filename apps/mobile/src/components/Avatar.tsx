import React, { useEffect, useState } from 'react';
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

const MAX_LOAD_RETRIES = 2;
const RETRY_DELAY_MS = 600;

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
// source or the image fails to load after a few retries (e.g. a broken avatarUrl, a missing
// crest asset, or - common on flaky connections - a transient network blip on remote photos).
export function Avatar({
  label,
  source,
  size = 36,
  backgroundColor = theme.colors.primary,
  textColor = theme.colors.surface,
  style,
}: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const uri = source && typeof source === 'object' && 'uri' in source ? source.uri : undefined;

  // A new source (e.g. after uploading a fresh avatar) deserves its own attempts.
  useEffect(() => {
    setFailed(false);
    setRetryCount(0);
  }, [uri]);

  function handleError() {
    if (retryCount < MAX_LOAD_RETRIES) {
      setTimeout(() => setRetryCount((count) => count + 1), RETRY_DELAY_MS);
    } else {
      setFailed(true);
    }
  }

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
          // Remount on each retry - Image doesn't re-attempt a load on its own after onError.
          key={retryCount}
          source={source}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          resizeMode="cover"
          onError={handleError}
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
