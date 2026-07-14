import React from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Avatar } from '../components/Avatar';
import { Card } from '../components/Card';
import { Header } from '../components/Header';
import { theme } from '../theme';
import { clearToken } from '../lib/authStore';
import type { RootTabParamList } from '../lib/RootNavigator';
import type { ProfileStackParamList } from '../lib/ProfileStack';
import { useProfile, useProfileStats, useProfileSubjects, useSchools, useUploadAvatar } from '../lib/queries';

const SETTINGS_ROWS = ['Edit profile', 'Log out'] as const;

type ProfileScreenNavigationProp = CompositeNavigationProp<
  NativeStackNavigationProp<ProfileStackParamList>,
  BottomTabNavigationProp<RootTabParamList>
>;

export default function ProfileScreen() {
  const navigation = useNavigation<ProfileScreenNavigationProp>();
  const profile = useProfile();
  const schools = useSchools();
  const profileStats = useProfileStats();
  const profileSubjects = useProfileSubjects();
  const uploadAvatar = useUploadAvatar();

  const schoolName = schools.data?.find((school) => school.id === profile.data?.schoolId)?.name;

  const stats = [
    { label: 'XP', value: (profile.data?.xp ?? 0).toLocaleString('en-US') },
    { label: 'Quizzes', value: (profileStats.data?.quizzesCompleted ?? 0).toLocaleString('en-US') },
    { label: 'Streak', value: (profileStats.data?.currentStreak ?? 0).toLocaleString('en-US') },
  ];

  async function handlePickAvatar() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo access to set a profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    uploadAvatar.mutate(
      { uri: asset.uri, name: asset.fileName ?? 'avatar.jpg', type: asset.mimeType ?? 'image/jpeg' },
      { onError: (error) => Alert.alert('Upload failed', error instanceof Error ? error.message : 'Could not upload your photo. Try again.') },
    );
  }

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
            <Pressable style={styles.cameraBadge} onPress={handlePickAvatar} disabled={uploadAvatar.isPending} hitSlop={8}>
              {uploadAvatar.isPending ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : (
                <Feather name="camera" size={14} color={theme.colors.primary} />
              )}
            </Pressable>
          </View>
          <Text style={styles.name}>{profile.data?.name}</Text>
          {schoolName && <Text style={styles.school}>{schoolName}</Text>}
        </View>

        <Card style={styles.statsCard}>
          {stats.map((stat) => (
            <View key={stat.label} style={styles.statColumn}>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </Card>

        <Card style={styles.subjectsCard}>
          <Text style={styles.sectionLabel}>STRONGEST SUBJECTS</Text>
          {profileSubjects.data && profileSubjects.data.length > 0 ? (
            profileSubjects.data.map((stat, index) => (
              <View
                key={stat.subject}
                style={[styles.subjectRow, index > 0 && styles.subjectRowDivider]}
              >
                <Text style={styles.subjectName}>{stat.subject}</Text>
                <Text style={styles.subjectAccuracy}>{stat.accuracy}%</Text>
              </View>
            ))
          ) : (
            <Text style={styles.subjectsEmpty}>Complete a quiz to see your subject stats.</Text>
          )}
        </Card>

        <Card style={styles.settingsCard}>
          {SETTINGS_ROWS.map((label) => (
            <Pressable
              key={label}
              style={styles.settingsRow}
              onPress={label === 'Log out' ? () => clearToken() : () => navigation.navigate('EditProfile')}
            >
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
    color: theme.colors.primary,
  },
  statLabel: {
    ...theme.type.caption,
    color: theme.colors.inkMuted,
  },
  subjectsCard: {
    gap: theme.spacing.sm,
  },
  sectionLabel: {
    ...theme.type.caption,
    fontFamily: theme.fonts.bodyMedium,
    color: theme.colors.inkMuted,
    letterSpacing: 1,
  },
  subjectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.xs,
  },
  subjectRowDivider: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.bg,
  },
  subjectName: {
    ...theme.type.bodyMedium,
    color: theme.colors.ink,
  },
  subjectAccuracy: {
    ...theme.type.bodyMedium,
    fontFamily: theme.fonts.bodyBold,
    color: theme.colors.accent,
  },
  subjectsEmpty: {
    ...theme.type.body,
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
