import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Pill } from '../components/Pill';
import { TimerBar } from '../components/TimerBar';
import { theme } from '../theme';
import type { QuizStackParamList } from '../lib/QuizStack';
import { useTimedRound } from '../lib/useTimedRound';

type Statement = {
  subject: string;
  statement: string;
  answer: boolean;
};

// Sample statements until the backend exists - cycled through in order, then the round ends.
const STATEMENTS: Statement[] = [
  {
    subject: 'Physics',
    statement: 'Light travels faster than sound.',
    answer: true,
  },
  {
    subject: 'Chemistry',
    statement: 'Water is composed of hydrogen and nitrogen.',
    answer: false,
  },
  {
    subject: 'Biology',
    statement: 'The human body has 206 bones as an adult.',
    answer: true,
  },
  {
    subject: 'Mathematics',
    statement: 'Zero is a prime number.',
    answer: false,
  },
  {
    subject: 'History',
    statement: 'The Great Wall of China is visible from the Moon with the naked eye.',
    answer: false,
  },
];

const ROUND_SECONDS = 15;
const XP_PER_CORRECT = 3;

export default function TrueOrFalseScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<QuizStackParamList>>();
  const {
    question: statement,
    secondsLeft,
    phase,
    selectedAnswer,
    totalXP,
    answered,
    earnedThisQuestion,
    submitAnswer,
    advance,
  } = useTimedRound<Statement, boolean>({
    questions: STATEMENTS,
    roundSeconds: ROUND_SECONDS,
    xpPerCorrect: XP_PER_CORRECT,
    isCorrect: (s, given) => given === s.answer,
  });

  if (phase === 'complete') {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.completeContent}>
          <Card style={styles.completeCard}>
            <Text style={styles.completeTitle}>Round complete</Text>
            <Text style={styles.completeXp}>+{totalXP} XP</Text>
            <Text style={styles.completeBody}>Total XP earned this round</Text>
          </Card>
          <Button label="Back to Quiz" variant="primary" onPress={() => navigation.navigate('QuizHome')} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
            <Feather name="chevron-left" size={26} color={theme.colors.ink} />
          </Pressable>
          <Text style={styles.roundLabel}>True or False</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.metaRow}>
          <Pill label={statement.subject} backgroundColor={theme.colors.bg} textColor={theme.colors.inkMuted} />
          <TimerBar secondsLeft={secondsLeft} totalSeconds={ROUND_SECONDS} />
        </View>

        <Card style={styles.statementCard}>
          <Text style={theme.type.h3}>{statement.statement}</Text>
        </Card>

        <View style={styles.options}>
          {([true, false] as const).map((value) => {
            const isCorrectOption = value === statement.answer;
            const isSelected = value === selectedAnswer;

            let tintStyle: ViewStyle = styles.optionDefault;
            if (answered) {
              if (isCorrectOption) {
                tintStyle = styles.optionCorrect;
              } else if (isSelected) {
                tintStyle = styles.optionIncorrect;
              } else {
                tintStyle = styles.optionMuted;
              }
            }

            return (
              <Pressable key={String(value)} onPress={() => submitAnswer(value)} disabled={answered}>
                <View style={[styles.option, tintStyle]}>
                  <Text style={styles.optionLabel}>{value ? 'True' : 'False'}</Text>
                  {answered && isCorrectOption && (
                    <Feather name="check" size={22} color={theme.colors.success} />
                  )}
                  {answered && isSelected && !isCorrectOption && (
                    <Feather name="x" size={22} color={theme.colors.accent} />
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>

        {answered && (
          <>
            <Text style={[styles.xpFeedback, earnedThisQuestion > 0 ? styles.xpPositive : styles.xpZero]}>
              +{earnedThisQuestion} XP
            </Text>
            <Button label="Continue" variant="primary" onPress={advance} />
          </>
        )}
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
  statementCard: {
    minHeight: 96,
    justifyContent: 'center',
  },
  options: {
    gap: theme.spacing.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    paddingVertical: theme.spacing.lg,
  },
  optionDefault: {
    backgroundColor: theme.colors.surface,
  },
  optionCorrect: {
    backgroundColor: theme.colors.successBg,
  },
  optionIncorrect: {
    backgroundColor: theme.colors.errorBg,
  },
  optionMuted: {
    backgroundColor: theme.colors.surface,
    opacity: 0.5,
  },
  optionLabel: {
    ...theme.type.h2,
    color: theme.colors.ink,
  },
  xpFeedback: {
    ...theme.type.h3,
    textAlign: 'center',
  },
  xpPositive: {
    color: theme.colors.success,
  },
  xpZero: {
    color: theme.colors.inkMuted,
  },
  completeContent: {
    flex: 1,
    padding: theme.spacing.md,
    justifyContent: 'center',
    gap: theme.spacing.lg,
  },
  completeCard: {
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  completeTitle: {
    ...theme.type.h2,
    color: theme.colors.ink,
  },
  completeXp: {
    ...theme.type.display,
    color: theme.colors.primary,
  },
  completeBody: {
    ...theme.type.body,
    color: theme.colors.inkMuted,
  },
});
