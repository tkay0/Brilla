import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Header } from '../components/Header';
import { HeaderStatus } from '../components/HeaderStatus';
import { theme } from '../theme';
import { useLeaderboard, useProfile, type LeaderboardEntry } from '../lib/queries';

function formatScore(score: number) {
  return score.toLocaleString('en-US');
}

const PODIUM_SLOTS = [
  { index: 1, avatarSize: 56, blockHeight: 130 },
  { index: 0, avatarSize: 72, blockHeight: 150 },
  { index: 2, avatarSize: 56, blockHeight: 120 },
];

export default function LeaderboardScreen() {
  const profile = useProfile();
  const leaderboardQuery = useLeaderboard(100);

  const data = leaderboardQuery.data;
  const podium = data?.leaderboard.slice(0, 3) ?? [];

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Header
          avatarLabel={profile.data?.name}
          avatarUrl={profile.data?.avatarUrl}
          right={<HeaderStatus xp={profile.data?.xp ?? 0} coins={profile.data?.coinBalance ?? 0} />}
        />
        <View style={styles.titleBlock}>
          <Text style={styles.title}>Leaderboard</Text>
          <Text style={styles.subtitle}>Showing top 100</Text>
        </View>

        {leaderboardQuery.isError && (
          <Card style={styles.limitCard}>
            <Text style={styles.limitTitle}>Couldn&rsquo;t load leaderboard</Text>
            <Text style={styles.limitBody}>Check your connection and try again.</Text>
            <Button label="Retry" variant="primary" onPress={() => leaderboardQuery.refetch()} />
          </Card>
        )}

        {leaderboardQuery.isLoading && (
          <View style={styles.centered}>
            <ActivityIndicator color={theme.colors.primary} />
          </View>
        )}

        {data && (
          <>
            <Card style={styles.podiumCard}>
              <View style={styles.podiumRow}>
                {PODIUM_SLOTS.map(({ index, avatarSize, blockHeight }) => {
                  const player = podium[index];
                  if (!player) return <View key={index} style={styles.podiumColumn} />;
                  return (
                    <View key={player.id} style={styles.podiumColumn}>
                      {player.rank === 1 && <Text style={styles.crown}>👑</Text>}
                      <Avatar
                        label={player.name}
                        source={player.avatarUrl ? { uri: player.avatarUrl } : undefined}
                        size={avatarSize}
                        style={styles.podiumAvatar}
                      />
                      <View style={[styles.podiumBlock, { height: blockHeight }]}>
                        <Text style={styles.podiumBlockRank}>{player.rank}</Text>
                        <Text style={styles.podiumName} numberOfLines={2}>
                          {player.name}
                        </Text>
                        <Text style={styles.podiumScore}>{formatScore(player.xp)} XP</Text>
                        <Text style={styles.podiumSchool} numberOfLines={2}>
                          {player.school}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </Card>

            <Card style={styles.listCard}>
              {data.leaderboard.map((player: LeaderboardEntry, index) => {
                const isMe = player.id === data.me.id;
                const isLast = index === data.leaderboard.length - 1;
                return (
                  <View
                    key={player.id}
                    style={[styles.listRow, !isLast && styles.listRowDivider, isMe && styles.listRowMe]}
                  >
                    <Text style={styles.listRank}>{player.rank}</Text>
                    <Avatar
                      label={player.name}
                      source={player.avatarUrl ? { uri: player.avatarUrl } : undefined}
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
                    <Text style={styles.listScore}>{formatScore(player.xp)}</Text>
                  </View>
                );
              })}
            </Card>
          </>
        )}
      </ScrollView>

      {data && (
        <View style={styles.currentUserRow}>
          <Text style={styles.currentUserRank}>{data.me.rank}</Text>
          <Avatar
            label={data.me.name}
            source={data.me.avatarUrl ? { uri: data.me.avatarUrl } : undefined}
            size={36}
            backgroundColor={theme.colors.surface}
            textColor={theme.colors.primary}
          />
          <View style={styles.listNameColumn}>
            <Text style={styles.currentUserName} numberOfLines={1}>
              {data.me.name}
            </Text>
            <Text style={styles.currentUserSchool} numberOfLines={1}>
              {data.me.school}
            </Text>
          </View>
          <Text style={styles.currentUserScore}>{formatScore(data.me.xp)}</Text>
        </View>
      )}
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
    paddingBottom: 100,
    gap: theme.spacing.md,
  },
  titleBlock: {
    gap: 2,
  },
  title: {
    ...theme.type.h1,
    color: theme.colors.ink,
  },
  subtitle: {
    ...theme.type.caption,
    color: theme.colors.inkMuted,
  },
  centered: {
    paddingVertical: theme.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  limitCard: {
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  limitTitle: {
    ...theme.type.h2,
    color: theme.colors.ink,
    textAlign: 'center',
  },
  limitBody: {
    ...theme.type.body,
    color: theme.colors.inkMuted,
    textAlign: 'center',
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
    padding: 0,
    overflow: 'hidden',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
  },
  listRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.bg,
  },
  listRowMe: {
    backgroundColor: theme.colors.successBg,
  },
  listRank: {
    ...theme.type.bodyMedium,
    color: theme.colors.inkMuted,
    width: 32,
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
