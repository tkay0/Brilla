import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
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

function formatOrdinal(rank: number) {
  const mod100 = rank % 100;

  if (mod100 >= 11 && mod100 <= 13) {
    return `${rank}th`;
  }

  switch (rank % 10) {
    case 1:
      return `${rank}st`;
    case 2:
      return `${rank}nd`;
    case 3:
      return `${rank}rd`;
    default:
      return `${rank}th`;
  }
}

const FIRST_AVATAR_SIZE = 60;
const SIDE_AVATAR_SIZE = 56;

// How much of the avatar sits above the card's top edge (vs. tucked inside it) - just
// the bottom sliver should rest on the card, per the reference design.
const AVATAR_OVERLAP_RATIO = 0.15;
const FIRST_AVATAR_OVERLAP = Math.round(FIRST_AVATAR_SIZE * AVATAR_OVERLAP_RATIO);
const SIDE_AVATAR_OVERLAP = Math.round(SIDE_AVATAR_SIZE * AVATAR_OVERLAP_RATIO);

// ribbon.png is 1000x903 - keep that aspect ratio at any width.
const RIBBON_ASPECT = 903 / 1000;
const RIBBON_WIDTH = 56;

// Rendered left-to-right as 2nd, 1st, 3rd so the winner sits in the middle, tallest slot.
const PODIUM_SLOTS = [
  { index: 1, isFirst: false },
  { index: 0, isFirst: true },
  { index: 2, isFirst: false },
];

export default function LeaderboardScreen() {
  const profile = useProfile();
  const leaderboardQuery = useLeaderboard(500);

  const data = leaderboardQuery.data;
  const podium = data?.leaderboard.slice(0, 3) ?? [];

  const scrollRef = useRef<ScrollView>(null);
  const [canShowGoToTop, setCanShowGoToTop] = useState(false);
  const [listCardY, setListCardY] = useState<number | null>(null);
  const [meRowY, setMeRowY] = useState<number | null>(null);
  const [pendingScrollToMe, setPendingScrollToMe] = useState(false);
  const hasScrolledRef = useRef(false);

  function scrollToMe(animated = true) {
    if (listCardY === null || meRowY === null) return false;
    scrollRef.current?.scrollTo({ y: Math.max(listCardY + meRowY - theme.spacing.md, 0), animated });
    return true;
  }

  function handleRankPress() {
    const didScroll = scrollToMe(true);
    if (!didScroll) {
      setPendingScrollToMe(true);
    }
  }

  // A fresh leaderboard load (or a different logged-in user) deserves its own
  // auto-scroll-to-me pass.
  useEffect(() => {
    hasScrolledRef.current = false;
    setListCardY(null);
    setMeRowY(null);
  }, [data?.me.id]);

  useEffect(() => {
    if (hasScrolledRef.current || listCardY === null || meRowY === null) return;
    hasScrolledRef.current = true;
    scrollToMe(true);
  }, [listCardY, meRowY]);

  useEffect(() => {
    if (!pendingScrollToMe) return;
    const didScroll = scrollToMe(true);
    if (didScroll) {
      setPendingScrollToMe(false);
    }
  }, [pendingScrollToMe, listCardY, meRowY]);

  function handleScroll(event: any) {
    setCanShowGoToTop(event.nativeEvent.contentOffset.y > 0);
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.content} onScroll={handleScroll} scrollEventThrottle={16}>
        <Header
          avatarLabel={profile.data?.name}
          avatarUrl={profile.data?.avatarUrl}
          right={<HeaderStatus xp={profile.data?.xp ?? 0} coins={profile.data?.coinBalance ?? 0} />}
        />
        <Text style={styles.title}>Leaderboard</Text>
        {data && (
          <Pressable onPress={handleRankPress} hitSlop={8} style={styles.rankCaptionTapArea}>
            <Text style={styles.rankCaption}>Your rank: {formatOrdinal(data.me.rank)}</Text>
          </Pressable>
        )}

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
            <View style={styles.podiumRow}>
              {PODIUM_SLOTS.map(({ index, isFirst }) => {
                const player = podium[index];
                if (!player) return <View key={index} style={styles.podiumSlot} />;
                const avatarSource = player.avatarUrl ? { uri: player.avatarUrl } : undefined;

                if (isFirst) {
                  return (
                    <View key={player.id} style={styles.podiumSlot}>
                      <Image
                        source={require('../../assets/images/ribbon.png')}
                        style={styles.ribbon}
                        resizeMode="contain"
                      />
                      <Avatar
                        label={player.name}
                        source={avatarSource}
                        size={FIRST_AVATAR_SIZE}
                        backgroundColor={theme.colors.surface}
                        textColor={theme.colors.primary}
                        style={styles.firstAvatar}
                      />
                      <View style={styles.firstCard}>
                        <Text style={styles.firstRank}>{player.rank}</Text>
                        <Text style={styles.firstName}>{player.name}</Text>
                        <Text style={styles.firstSchool}>{player.school}</Text>
                        <Text style={styles.firstScore}>{formatScore(player.xp)}</Text>
                      </View>
                    </View>
                  );
                }

                return (
                  <View key={player.id} style={styles.podiumSlot}>
                    <Avatar
                      label={player.name}
                      source={avatarSource}
                      size={SIDE_AVATAR_SIZE}
                      style={styles.sideAvatar}
                    />
                    <View style={styles.sideCard}>
                      <View style={styles.sideCardStrip} />
                      <View style={styles.sideCardBody}>
                        <Text style={styles.sideRank}>{player.rank}</Text>
                        <Text style={styles.sideName}>{player.name}</Text>
                        <Text style={styles.sideSchool}>{player.school}</Text>
                        <Text style={styles.sideScore}>{formatScore(player.xp)}</Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>

            <Card style={styles.listCard} onLayout={(e) => setListCardY(e.nativeEvent.layout.y)}>
              {data.leaderboard.map((player: LeaderboardEntry, index) => {
                const isMe = player.id === data.me.id;
                const isLast = index === data.leaderboard.length - 1;
                return (
                  <View
                    key={player.id}
                    style={[styles.listRow, !isLast && styles.listRowDivider, isMe && styles.listRowMe]}
                    onLayout={isMe ? (e) => setMeRowY(e.nativeEvent.layout.y) : undefined}
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

      {data && canShowGoToTop && (
        <Pressable
          style={styles.goToTop}
          onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
          hitSlop={8}
        >
          <Text style={styles.goToTopLabel}>Go to Top</Text>
          <Feather name="chevron-up" size={16} color={theme.colors.primary} />
        </Pressable>
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
    paddingTop: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    gap: theme.spacing.md,
  },
  title: {
    ...theme.type.h1,
    color: theme.colors.ink,
  },
  rankCaption: {
    ...theme.type.caption,
    fontFamily: theme.fonts.bodyMedium,
    color: theme.colors.ink,
    marginTop: -theme.spacing.xs,
  },
  rankCaptionTapArea: {
    alignSelf: 'flex-start',
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
  podiumRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: theme.spacing.sm,
  },
  podiumSlot: {
    flex: 1,
    alignItems: 'center',
  },
  // Rank 1: navy card, flat bottom, avatar + winner ribbon overlapping the top edge.
  ribbon: {
    width: RIBBON_WIDTH,
    height: RIBBON_WIDTH * RIBBON_ASPECT,
    marginBottom: -14,
    zIndex: 2,
  },
  firstAvatar: {
    marginBottom: -FIRST_AVATAR_OVERLAP,
    zIndex: 1,
    borderWidth: 2,
    borderColor: theme.colors.surface,
  },
  firstCard: {
    width: '100%',
    minHeight: 160,
    backgroundColor: theme.colors.primary,
    borderTopLeftRadius: theme.radii.lg,
    borderTopRightRadius: theme.radii.lg,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    alignItems: 'center',
    // Just enough to clear the sliver of avatar overlapping the top edge.
    paddingTop: FIRST_AVATAR_OVERLAP + theme.spacing.xs,
    paddingBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.xs,
    gap: 2,
  },
  firstRank: {
    ...theme.type.h2,
    color: theme.colors.surface,
  },
  firstName: {
    ...theme.type.caption,
    fontFamily: theme.fonts.bodyMedium,
    color: theme.colors.surface,
    textAlign: 'center',
    marginTop: theme.spacing.xs,
  },
  firstSchool: {
    ...theme.type.caption,
    color: theme.colors.surface,
    opacity: 0.75,
    textAlign: 'center',
  },
  firstScore: {
    ...theme.type.h3,
    color: theme.colors.surface,
    marginTop: theme.spacing.md,
  },
  // Rank 2/3: white card, flat bottom, red top strip, avatar overlapping the top edge.
  sideAvatar: {
    marginBottom: -SIDE_AVATAR_OVERLAP,
    zIndex: 1,
    borderWidth: 2,
    borderColor: theme.colors.surface,
  },
  sideCard: {
    width: '100%',
    minHeight: 115,
    borderTopLeftRadius: theme.radii.lg,
    borderTopRightRadius: theme.radii.lg,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    backgroundColor: theme.colors.surface,
    overflow: 'hidden',
  },
  sideCardStrip: {
    height: 2,
    backgroundColor: theme.colors.accent,
  },
  sideCardBody: {
    alignItems: 'center',
    // Just enough to clear the sliver of avatar overlapping the top edge.
    paddingTop: SIDE_AVATAR_OVERLAP + theme.spacing.xs,
    paddingBottom: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xs,
    gap: 2,
  },
  sideRank: {
    ...theme.type.h3,
    color: theme.colors.accent,
  },
  sideName: {
    ...theme.type.caption,
    fontFamily: theme.fonts.bodyMedium,
    color: theme.colors.ink,
    textAlign: 'center',
    marginTop: theme.spacing.xs,
  },
  sideSchool: {
    ...theme.type.caption,
    color: theme.colors.inkMuted,
    textAlign: 'center',
  },
  sideScore: {
    ...theme.type.bodyMedium,
    fontFamily: theme.fonts.bodyMedium,
    color: theme.colors.primary,
    marginTop: theme.spacing.md,
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
  goToTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: theme.spacing.sm,
  },
  goToTopLabel: {
    ...theme.type.bodyMedium,
    color: theme.colors.primary,
  },
});
