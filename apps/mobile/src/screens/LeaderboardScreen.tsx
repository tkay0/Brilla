import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar } from '../components/Avatar';
import { Card } from '../components/Card';
import { Header } from '../components/Header';
import { HeaderStatus } from '../components/HeaderStatus';
import { theme } from '../theme';
import { SAMPLE_HEADER_USER } from '../lib/sampleData';

type Player = {
  rank: number;
  name: string;
  school: string;
  score: number;
};

// Sample data until the leaderboard API exists - shape (rank/name/school/score) mirrors
// what the backend is expected to return.
const PODIUM: Player[] = [
  { rank: 1, name: 'Ama Boateng', school: 'Achimota School', score: 2840 },
  { rank: 2, name: 'Kwame Mensah', school: 'Presec Legon', score: 2715 },
  { rank: 3, name: "Efua Owusu", school: "Wesley Girls'", score: 2690 },
];

const RANKED_LIST: Player[] = [
  { rank: 4, name: 'Yaw Darko', school: 'Adisadel College', score: 2410 },
  { rank: 5, name: 'Abena Asante', school: 'Mfantsipim School', score: 2355 },
  { rank: 6, name: "Kojo Appiah", school: "St. Augustine's College", score: 2290 },
  { rank: 7, name: 'Akosua Frimpong', school: 'Holy Child School', score: 2180 },
];

const CURRENT_USER: Player = { rank: 482, name: 'You', school: 'Accra Academy', score: 940 };

function formatScore(score: number) {
  return score.toLocaleString('en-US');
}

const PODIUM_ORDER: Array<{ player: Player; avatarSize: number; blockHeight: number }> = [
  { player: PODIUM[1], avatarSize: 56, blockHeight: 130 },
  { player: PODIUM[0], avatarSize: 72, blockHeight: 150 },
  { player: PODIUM[2], avatarSize: 56, blockHeight: 120 },
];

export default function LeaderboardScreen() {
  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Header right={<HeaderStatus {...SAMPLE_HEADER_USER} />} />
        <Text style={styles.title}>Leaderboard</Text>

        <Card style={styles.podiumCard}>
          <View style={styles.podiumRow}>
            {PODIUM_ORDER.map(({ player, avatarSize, blockHeight }) => (
              <View key={player.rank} style={styles.podiumColumn}>
                {player.rank === 1 && <Text style={styles.crown}>👑</Text>}
                <Avatar
                  label={player.name}
                  size={avatarSize}
                  style={styles.podiumAvatar}
                />
                <View style={[styles.podiumBlock, { height: blockHeight }]}>
                  <Text style={styles.podiumBlockRank}>{player.rank}</Text>
                  <Text style={styles.podiumName} numberOfLines={2}>
                    {player.name}
                  </Text>
                  <Text style={styles.podiumScore}>{formatScore(player.score)} XP</Text>
                  <Text style={styles.podiumSchool} numberOfLines={2}>
                    {player.school}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </Card>

        <Card style={styles.listCard}>
          {RANKED_LIST.map((player) => (
            <View key={player.rank} style={styles.listRow}>
              <Text style={styles.listRank}>{player.rank}</Text>
              <Avatar
                label={player.name}
                size={36}
                backgroundColor={theme.colors.bg}
                textColor={theme.colors.primary}
              />
              <View style={styles.listNameColumn}>
                <Text style={styles.listName} numberOfLines={1}>
                  {player.name}
                </Text>
                <Text style={styles.listSchool} numberOfLines={1}>
                  {player.school}
                </Text>
              </View>
              <Text style={styles.listScore}>{formatScore(player.score)}</Text>
            </View>
          ))}
        </Card>
      </ScrollView>

      <View style={styles.currentUserRow}>
        <Text style={styles.currentUserRank}>{CURRENT_USER.rank}</Text>
        <Avatar
          label={CURRENT_USER.name}
          size={36}
          backgroundColor={theme.colors.surface}
          textColor={theme.colors.primary}
        />
        <View style={styles.listNameColumn}>
          <Text style={styles.currentUserName} numberOfLines={1}>
            {CURRENT_USER.name}
          </Text>
          <Text style={styles.currentUserSchool} numberOfLines={1}>
            {CURRENT_USER.school}
          </Text>
        </View>
        <Text style={styles.currentUserScore}>{formatScore(CURRENT_USER.score)}</Text>
      </View>
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
  title: {
    ...theme.type.h1,
    color: theme.colors.ink,
  },
  podiumCard: {
    paddingBottom: 0,
  },
  podiumRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  podiumColumn: {
    flex: 1,
    alignItems: 'center',
  },
  crown: {
    fontSize: 22,
    marginBottom: theme.spacing.xs,
  },
  podiumAvatar: {
    marginBottom: theme.spacing.xs,
  },
  podiumName: {
    ...theme.type.caption,
    fontFamily: theme.fonts.bodyMedium,
    color: theme.colors.ink,
    textAlign: 'center',
  },
  podiumBlock: {
    width: '100%',
    backgroundColor: theme.colors.bg,
    borderTopLeftRadius: theme.radii.sm,
    borderTopRightRadius: theme.radii.sm,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xs,
    gap: 2,
  },
  podiumBlockRank: {
    ...theme.type.bodyMedium,
    color: theme.colors.inkMuted,
    marginBottom: theme.spacing.xs,
  },
  podiumScore: {
    ...theme.type.caption,
    color: theme.colors.inkMuted,
  },
  podiumSchool: {
    ...theme.type.caption,
    color: theme.colors.inkMuted,
    textAlign: 'center',
    marginTop: theme.spacing.xs,
  },
  listCard: {
    gap: theme.spacing.sm,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  listRank: {
    ...theme.type.bodyMedium,
    color: theme.colors.inkMuted,
    width: 20,
    textAlign: 'center',
  },
  listNameColumn: {
    flex: 1,
    gap: 2,
  },
  listName: {
    ...theme.type.bodyMedium,
    color: theme.colors.ink,
  },
  listSchool: {
    ...theme.type.caption,
    color: theme.colors.inkMuted,
  },
  listScore: {
    ...theme.type.bodyMedium,
    color: theme.colors.ink,
  },
  currentUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.primary,
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radii.lg,
  },
  currentUserRank: {
    ...theme.type.bodyMedium,
    color: theme.colors.surface,
    width: 32,
    textAlign: 'center',
  },
  currentUserName: {
    ...theme.type.bodyMedium,
    color: theme.colors.surface,
  },
  currentUserSchool: {
    ...theme.type.caption,
    color: theme.colors.surface,
    opacity: 0.8,
  },
  currentUserScore: {
    ...theme.type.bodyMedium,
    color: theme.colors.surface,
  },
});
