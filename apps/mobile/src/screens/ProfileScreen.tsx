import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Card } from '../components/Card';
import { theme } from '../theme';

// Sample data until auth + a real profile API exist.
const USER = {
  name: 'Kojo Antwi',
  school: 'Accra Academy',
};

const STATS = [
  { label: 'XP', value: '1,240' },
  { label: 'Quizzes', value: '86' },
  { label: 'Best streak', value: '14' },
];

const SETTINGS_ROWS = ['Edit profile', 'Notifications', 'Log out'] as const;

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default function ProfileScreen() {
  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.identity}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              <Text style={styles.avatarLabel}>{initials(USER.name)}</Text>
            </View>
            <Pressable style={styles.cameraBadge} onPress={() => {}} hitSlop={8}>
              <Feather name="camera" size={14} color={theme.colors.primary} />
            </Pressable>
          </View>
          <Text style={styles.name}>{USER.name}</Text>
          <Text style={styles.school}>{USER.school}</Text>
        </View>

        <Card style={styles.statsCard}>
          {STATS.map((stat) => (
            <View key={stat.label} style={styles.statColumn}>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </Card>

        <Card style={styles.settingsCard}>
          {SETTINGS_ROWS.map((label) => (
            <Pressable key={label} style={styles.settingsRow} onPress={() => {}}>
              <Text style={styles.settingsLabel}>{label}</Text>
              <Feather name="chevron-right" size={20} color={theme.colors.inkMuted} />
            </Pressable>
          ))}
        </Card>
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
    gap: theme.spacing.md,
  },
  identity: {
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.sm,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLabel: {
    ...theme.type.h1,
    color: theme.colors.surface,
  },
  cameraBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    ...theme.type.h2,
    color: theme.colors.ink,
    marginTop: theme.spacing.sm,
  },
  school: {
    ...theme.type.body,
    color: theme.colors.inkMuted,
  },
  statsCard: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statColumn: {
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  statValue: {
    ...theme.type.h2,
    color: theme.colors.ink,
  },
  statLabel: {
    ...theme.type.caption,
    color: theme.colors.inkMuted,
  },
  settingsCard: {
    padding: 0,
    overflow: 'hidden',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
  },
  settingsLabel: {
    ...theme.type.bodyMedium,
    color: theme.colors.ink,
  },
});
