import React from 'react';
import { ImageSourcePropType, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Header } from '../components/Header';
import { HeaderStatus } from '../components/HeaderStatus';
import { Pill } from '../components/Pill';
import { theme } from '../theme';
import type { RootTabParamList } from '../lib/RootNavigator';
import { SAMPLE_HEADER_USER } from '../lib/sampleData';

// Static/sample content until the backend exists (announcement) - wired up for real data
// later without changing the layout.
const ANNOUNCEMENT_TAG = 'Announcement';
const ANNOUNCEMENT_TITLE = 'Regional Qualifiers';
const ANNOUNCEMENT_DATE = '16–17 July';

// NSMQ past-champion schools, ranked by title count (highest first). Crest images live in
// assets/images/; any entry without a matching file falls back to a school-initials badge.
const SCHOOL_IMAGES: Record<string, ImageSourcePropType> = {
  presec: require('../../assets/images/presec.png'),
  prempeh: require('../../assets/images/prempeh.jpg'),
  mfantsipim: require('../../assets/images/mfantsipim.png'),
  'st-peters': require('../../assets/images/st-peters.jpg'),
  'st-augustines': require('../../assets/images/st-augustines.jpg'),
  achimota: require('../../assets/images/achimota.jpg'),
  opoku: require('../../assets/images/opoku.jpg'),
  adisadel: require('../../assets/images/adisadel.jpg'),
  aquinas: require('../../assets/images/aquinas.jpg'),
  gsts: require('../../assets/images/gsts.jpg'),
  pope: require('../../assets/images/pope.jpg'),
};

type HallOfFameEntry = { name: string; titles: number; imageKey: keyof typeof SCHOOL_IMAGES };

const HALL_OF_FAME: HallOfFameEntry[] = [
  { name: 'PRESEC, Legon', titles: 8, imageKey: 'presec' },
  { name: 'Prempeh College', titles: 5, imageKey: 'prempeh' },
  { name: 'Mfantsipim School', titles: 4, imageKey: 'mfantsipim' },
  { name: "St. Peter's SHS (PERSCO)", titles: 3, imageKey: 'st-peters' },
  { name: "St. Augustine's College (AUGUSCO)", titles: 2, imageKey: 'st-augustines' },
  { name: 'Achimota School', titles: 2, imageKey: 'achimota' },
  { name: 'Opoku Ware School (OWASS)', titles: 2, imageKey: 'opoku' },
  { name: 'Adisadel College', titles: 1, imageKey: 'adisadel' },
  { name: 'St. Thomas Aquinas SHS', titles: 1, imageKey: 'aquinas' },
  { name: 'Ghana Secondary Technical School (GSTS)', titles: 1, imageKey: 'gsts' },
  { name: 'Pope John SHS & Minor Seminary', titles: 1, imageKey: 'pope' },
];

export default function HomeScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Header right={<HeaderStatus {...SAMPLE_HEADER_USER} />} />

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

        <Text style={styles.sectionLabel}>HALL OF FAME</Text>
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
  sectionLabel: {
    ...theme.type.caption,
    fontFamily: theme.fonts.bodyMedium,
    color: theme.colors.inkMuted,
    letterSpacing: 1,
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
