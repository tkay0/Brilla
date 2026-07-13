import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Header } from '../components/Header';
import { Pill } from '../components/Pill';
import { theme } from '../theme';
import type { RootTabParamList } from '../lib/RootNavigator';

// Static/sample content until the backend exists (XP total, announcement) - wired up for
// real data later without changing the layout.
const SAMPLE_XP = '1,240 XP';
const ANNOUNCEMENT_TAG = 'Announcement';
const ANNOUNCEMENT_TITLE = 'Regional Qualifiers';
const ANNOUNCEMENT_DATE = '16–17 July';

export default function HomeScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Header right={<Pill label={SAMPLE_XP} backgroundColor={theme.colors.primary} textColor={theme.colors.surface} />} />

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
          <Text style={styles.body}>{ANNOUNCEMENT_DATE}</Text>
        </Card>

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
});
