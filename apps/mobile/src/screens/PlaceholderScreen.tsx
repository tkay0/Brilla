import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { theme } from '../theme';

type PlaceholderScreenProps = {
  name: string;
};

// Shared placeholder body for every tab until its real screen is built - proves the
// navigation shell (tabs, icons, tint colors) works end to end before any real content
// exists.
export function PlaceholderScreen({ name }: PlaceholderScreenProps) {
  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <Text style={styles.title}>{name}</Text>
        <Card style={styles.card}>
          <Text style={theme.type.h3}>Coming soon</Text>
          <Text style={styles.body}>This screen hasn't been built yet - you're looking at the navigation shell.</Text>
        </Card>
        <Button label="Placeholder action" variant="primary" onPress={() => {}} />
      </View>
    </SafeAreaView>
  );
}

export default PlaceholderScreen;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  content: {
    flex: 1,
    padding: theme.spacing.md,
    justifyContent: 'center',
    gap: theme.spacing.lg,
  },
  title: {
    ...theme.type.display,
    color: theme.colors.ink,
    textAlign: 'center',
  },
  card: {
    gap: theme.spacing.xs,
  },
  body: {
    ...theme.type.body,
    color: theme.colors.inkMuted,
    marginTop: theme.spacing.xs,
  },
});
