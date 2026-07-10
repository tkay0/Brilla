import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { theme } from '../theme';

const SWATCHES: { name: string; value: string }[] = [
  { name: 'primary', value: theme.colors.primary },
  { name: 'accent', value: theme.colors.accent },
  { name: 'bg', value: theme.colors.bg },
  { name: 'surface', value: theme.colors.surface },
  { name: 'ink', value: theme.colors.ink },
  { name: 'inkMuted', value: theme.colors.inkMuted },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

export default function StyleGuideScreen() {
  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.pageTitle}>Style Guide</Text>

        <Section title="Colors">
          <View style={styles.swatchRow}>
            {SWATCHES.map((s) => (
              <View key={s.name} style={styles.swatchItem}>
                <View style={[styles.swatch, { backgroundColor: s.value }]} />
                <Text style={styles.swatchName}>{s.name}</Text>
                <Text style={styles.swatchValue}>{s.value}</Text>
              </View>
            ))}
          </View>
        </Section>

        <Section title="Type scale">
          <Text style={theme.type.display}>Display 96</Text>
          <Text style={theme.type.h1}>Heading 1</Text>
          <Text style={theme.type.h2}>Heading 2</Text>
          <Text style={theme.type.h3}>Heading 3</Text>
          <Text style={theme.type.bodyLg}>Body large - Plus Jakarta Sans</Text>
          <Text style={theme.type.body}>Body regular - Plus Jakarta Sans</Text>
          <Text style={theme.type.bodyMedium}>Body medium - Plus Jakarta Sans</Text>
          <Text style={theme.type.caption}>Caption - Plus Jakarta Sans</Text>
        </Section>

        <Section title="Buttons">
          <Button label="Primary button" variant="primary" onPress={() => {}} />
          <View style={{ height: theme.spacing.sm }} />
          <Button label="Secondary button" variant="secondary" onPress={() => {}} />
        </Section>

        <Section title="Flat card">
          <Card>
            <Text style={theme.type.h3}>Card title</Text>
            <Text style={[theme.type.body, { color: theme.colors.inkMuted, marginTop: theme.spacing.xs }]}>
              No border, no shadow - just the surface color against the page background.
            </Text>
          </Card>
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  content: {
    padding: theme.spacing.md,
    gap: theme.spacing.lg,
  },
  pageTitle: {
    ...theme.type.h1,
    color: theme.colors.ink,
    marginBottom: theme.spacing.xs,
  },
  section: {
    gap: theme.spacing.sm,
  },
  sectionTitle: {
    ...theme.type.caption,
    color: theme.colors.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  swatchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  swatchItem: {
    width: 96,
  },
  swatch: {
    width: 96,
    height: 64,
    borderRadius: theme.radii.md,
    marginBottom: theme.spacing.xs,
  },
  swatchName: {
    ...theme.type.bodyMedium,
    color: theme.colors.ink,
  },
  swatchValue: {
    ...theme.type.caption,
    color: theme.colors.inkMuted,
  },
});
