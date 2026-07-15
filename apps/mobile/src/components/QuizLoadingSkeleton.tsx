import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card } from './Card';
import { ShimmerBlock } from './ShimmerBlock';
import { theme } from '../theme';

type QuizLoadingSkeletonProps = {
  roundLabel: string;
  showMeta?: boolean;
  optionCount?: number;
  actionCount?: number;
};

export function QuizLoadingSkeleton({
  roundLabel,
  showMeta = true,
  optionCount = 4,
  actionCount = 0,
}: QuizLoadingSkeletonProps) {
  return (
    <View style={styles.content}>
      <View style={styles.headerRow}>
        <ShimmerBlock width={26} height={26} borderRadius={13} />
        <Text style={styles.roundLabel}>{roundLabel}</Text>
        <View style={styles.headerSpacer} />
      </View>

      {showMeta && (
        <View style={styles.metaRow}>
          <ShimmerBlock width={96} height={30} borderRadius={15} />
          <ShimmerBlock width={112} height={10} borderRadius={5} />
        </View>
      )}

      <Card style={styles.questionCard}>
        <ShimmerBlock height={18} style={styles.questionLine} />
        <ShimmerBlock width="72%" height={18} style={styles.questionLine} />
      </Card>

      {optionCount > 0 && (
        <View style={styles.options}>
          {Array.from({ length: optionCount }).map((_, index) => (
            <ShimmerBlock key={index} height={54} borderRadius={theme.radii.lg} />
          ))}
        </View>
      )}

      {actionCount > 0 && (
        <View style={[styles.actions, actionCount > 1 && styles.actionsRow]}>
          {Array.from({ length: actionCount }).map((_, index) => (
            <ShimmerBlock
              key={index}
              height={48}
              style={actionCount > 1 ? styles.actionHalf : undefined}
              borderRadius={theme.radii.md}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    padding: theme.spacing.md,
    gap: theme.spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  roundLabel: {
    ...theme.type.h3,
    color: theme.colors.ink,
  },
  headerSpacer: {
    width: 26,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  questionCard: {
    minHeight: 96,
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  questionLine: {
    alignSelf: 'stretch',
  },
  options: {
    gap: theme.spacing.sm,
  },
  actions: {
    gap: theme.spacing.sm,
  },
  actionsRow: {
    flexDirection: 'row',
  },
  actionHalf: {
    flex: 1,
  },
});

export default QuizLoadingSkeleton;
