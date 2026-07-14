import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Header } from '../components/Header';
import { HeaderStatus } from '../components/HeaderStatus';
import { Pill } from '../components/Pill';
import { theme } from '../theme';
import type { RootTabParamList } from '../lib/RootNavigator';
import type { HomeStackParamList } from '../lib/HomeStack';
import { useProfile } from '../lib/queries';
import { HALL_OF_FAME, SCHOOL_IMAGES } from '../lib/hallOfFame';

type HomeScreenNavigationProp = CompositeNavigationProp<
  NativeStackNavigationProp<HomeStackParamList>,
  BottomTabNavigationProp<RootTabParamList>
>;

// Static/sample content until the backend exists (announcement) - wired up for real data
// later without changing the layout.
const ANNOUNCEMENT_TAG = 'Announcement';
const ANNOUNCEMENT_TITLE = 'Regional Championship';
const ANNOUNCEMENT_CONTENT = 'The 2026 NSMQ Regional Championship has been cancelled due to sponsorship issues.';

export default function HomeScreen() {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const profile = useProfile();

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Header
          avatarLabel={profile.data?.name}
          avatarUrl={profile.data?.avatarUrl}
          right={<HeaderStatus xp={profile.data?.xp ?? 0} coins={profile.data?.coinBalance ?? 0} />}
        />

        <Card style={styles.card}>
          <Text style={theme.type.h3}>What is NSMQ?</Text>
          <Text style={styles.body}>
            The National Science and Maths Quiz has run since 1993, testing senior high school
            students across Ghana on science and maths in a fast-paced, 5-round contest.
          </Text>
          <Pressable onPress={() => {}} hitSlop={8}>
            <Text style={styles.readMore}>Read more</Text>
          </Pressable>
        </Card>

        <Card style={styles.card}>
          <Pill label={ANNOUNCEMENT_TAG} backgroundColor={theme.colors.accent} textColor={theme.colors.surface} />
          <Text style={[theme.type.h3, styles.announcementTitle]}>{ANNOUNCEMENT_TITLE}</Text>
          <Text style={styles.body}>{ANNOUNCEMENT_CONTENT}</Text>
        </Card>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>HALL OF FAME</Text>
          <Pressable style={styles.allRow} onPress={() => navigation.navigate('HallOfFame')} hitSlop={8}>
            <Text style={styles.allLabel}>All</Text>
            <Feather name="chevron-right" size={16} color={theme.colors.primary} />
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hofRow}>
          {HALL_OF_FAME.map((entry) => (
            <Card key={entry.name} style={styles.hofCard}>
              <Avatar label={entry.name} source={SCHOOL_IMAGES[entry.imageKey]} size={48} />
              <Text style={styles.hofName} numberOfLines={2}>
                {entry.name}
              </Text>
              <Text style={styles.hofTitles}>
                {entry.titles} title{entry.titles > 1 ? 's' : ''}
              </Text>
              <Text style={styles.hofStars}>{'⭐'.repeat(entry.titles)}</Text>
            </Card>
          ))}
        </ScrollView>

        <Button label="Start practicing" variant="primary" onPress={() => navigation.navigate('Quiz')} />
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
  card: {
    gap: theme.spacing.xs,
  },
  body: {
    ...theme.type.body,
    color: theme.colors.inkMuted,
  },
  readMore: {
    ...theme.type.bodyMedium,
    color: theme.colors.primary,
    marginTop: theme.spacing.xs,
  },
  announcementTitle: {
    marginTop: theme.spacing.xs,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionLabel: {
    ...theme.type.caption,
    fontFamily: theme.fonts.bodyMedium,
    color: theme.colors.inkMuted,
    letterSpacing: 1,
  },
  allRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  allLabel: {
    ...theme.type.bodyMedium,
    color: theme.colors.primary,
  },
  hofRow: {
    gap: theme.spacing.sm,
    paddingRight: theme.spacing.md,
  },
  hofCard: {
    width: 130,
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  hofName: {
    ...theme.type.bodyMedium,
    color: theme.colors.ink,
    textAlign: 'center',
  },
  hofTitles: {
    ...theme.type.caption,
    color: theme.colors.inkMuted,
  },
  hofStars: {
    fontSize: 12,
  },
});
