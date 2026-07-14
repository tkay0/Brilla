import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';
import { Avatar } from '../components/Avatar';
import { Card } from '../components/Card';
import { Header } from '../components/Header';
import { OutOfCoinsModal } from '../components/OutOfCoinsModal';
import { theme } from '../theme';
import { clearToken } from '../lib/authStore';
import type { RootTabParamList } from '../lib/RootNavigator';
import { useProfile } from '../lib/queries';

const SETTINGS_ROWS = ['Edit profile', 'Notifications', 'Log out'] as const;

export default function ProfileScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();
  const [outOfCoinsVisible, setOutOfCoinsVisible] = useState(false);
  const profile = useProfile();

  const stats = [
    { label: 'XP', value: (profile.data?.xp ?? 0).toLocaleString('en-US') },
    { label: 'Quizzes', value: '86' },
    { label: 'Best streak', value: '14' },
  ];

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Header avatarLabel={profile.data?.name} avatarUrl={profile.data?.avatarUrl} />
        <View style={styles.identity}>
          <View style={styles.avatarWrap}>
            <Avatar
              label={profile.data?.name ?? ''}
              source={profile.data?.avatarUrl ? { uri: profile.data.avatarUrl } : undefined}
              size={96}
            />
            <Pressable style={styles.cameraBadge} onPress={() => {}} hitSlop={8}>
              <Feather name="camera" size={14} color={theme.colors.primary} />
            </Pressable>
          </View>
          <Text style={styles.name}>{profile.data?.name}</Text>
        </View>

        <Card style={styles.statsCard}>
          {stats.map((stat) => (
            <View key={stat.label} style={styles.statColumn}>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </Card>

        <Card style={styles.settingsCard}>
          {SETTINGS_ROWS.map((label) => (
            <Pressable
              key={label}
              style={styles.settingsRow}
              onPress={label === 'Log out' ? () => clearToken() : () => {}}
            >
              <Text style={styles.settingsLabel}>{label}</Text>
              <Feather name="chevron-right" size={20} color={theme.colors.inkMuted} />
            </Pressable>
          ))}
        </Card>

        <Pressable style={styles.debugRow} onPress={() => setOutOfCoinsVisible(true)}>
          <Feather name="terminal" size={16} color={theme.colors.inkMuted} />
          <Text style={styles.debugLabel}>Debug: show &ldquo;out of coins&rdquo; modal</Text>
        </Pressable>
      </ScrollView>

      <OutOfCoinsModal
        visible={outOfCoinsVisible}
        onRequestClose={() => setOutOfCoinsVisible(false)}
        onGoToStore={() => {
          setOutOfCoinsVisible(false);
          navigation.navigate('Store');
        }}
        onBackToHome={() => {
          setOutOfCoinsVisible(false);
          navigation.navigate('Home');
        }}
      />
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
  debugRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.sm,
  },
  debugLabel: {
    ...theme.type.caption,
    color: theme.colors.inkMuted,
  },
});
