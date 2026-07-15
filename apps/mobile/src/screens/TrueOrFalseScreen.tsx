import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Pill } from '../components/Pill';
import { TimerBar } from '../components/TimerBar';
import { OutOfCoinsModal } from '../components/OutOfCoinsModal';
import { QuizLoadingSkeleton } from '../components/QuizLoadingSkeleton';
import { theme } from '../theme';
import type { QuizStackParamList } from '../lib/QuizStack';
import type { RootTabParamList } from '../lib/RootNavigator';
import { ApiError } from '../lib/api';
import { useProfileLimits, useQuestions, useSubmitAttempt } from '../lib/queries';

const ROUND_SECONDS = 15;
const QUESTION_COUNT = 10;

// True/False questions carry their answer as the string "true"/"false" in correctAnswer
// (no options array server-side) - these are the only two selectable values.
const TRUE_FALSE_OPTIONS = ['true', 'false'] as const;

// Submitted in place of a real selectedOption on timeout. Scored questions require a
// selectedOption server-side, and this value can never match a real correctAnswer, so the
// backend grades it as incorrect and deducts XP the same as any other wrong answer.
const TIMEOUT_SENTINEL = '__timeout__';

type RoundPhase = 'active' | 'submitting' | 'answered' | 'complete';

export default function TrueOrFalseScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<QuizStackParamList>>();
  const limits = useProfileLimits();
  const submitAttempt = useSubmitAttempt();

  // Set once a 403 arrives mid-round (the 20/day limit was hit by a submission during play,
  // not just found stale at screen-open time) - forces the same "try another round" gating
  // below regardless of what the cached limits still say until they're refetched.
  const [limitHitMidRound, setLimitHitMidRound] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(ROUND_SECONDS);
  const [phase, setPhase] = useState<RoundPhase>('active');
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{ correct: boolean; xpEarned: number } | null>(null);
  const [totalXP, setTotalXP] = useState(0);

  const trueFalseRemaining = limits.data?.TrueFalse ?? null;
  const allZero =
    !!limits.data && limits.data.SpeedRace === 0 && limits.data.TrueFalse === 0 && limits.data.Riddle === 0;
  const trueFalseExhausted = limitHitMidRound || trueFalseRemaining === 0;
  const canStartRound = !!limits.data && !allZero && !trueFalseExhausted;

  const questionsQuery = useQuestions('TrueFalse', QUESTION_COUNT, { enabled: canStartRound });
  const questions = questionsQuery.data;
  const question = questions?.[currentIndex];

  const submitAnswer = useCallback(
    (option: string | null) => {
      if (phase !== 'active' || !question) return;
      setPhase('submitting');
      submitAttempt.mutate(
        { questionId: question.id, selectedOption: option ?? TIMEOUT_SENTINEL },
        {
          onSuccess: (result) => {
            setSelectedOption(option);
            setLastResult({ correct: result.correct, xpEarned: result.xpEarned });
            setTotalXP((xp) => xp + result.xpEarned);
            setPhase('answered');
          },
          onError: (error) => {
            if (error instanceof ApiError && error.status === 403) {
              setLimitHitMidRound(true);
              limits.refetch();
            } else {
              // Transient/network failure - let the user retry this question rather than
              // silently eating the answer.
              setPhase('active');
            }
          },
        },
      );
    },
    [phase, question, submitAttempt, limits],
  );

  // Countdown ticks once per second while a question is active; hitting 0 submits a timeout
  // (no selection) the same way an explicit tap would.
  useEffect(() => {
    if (phase !== 'active') return;
    if (secondsLeft <= 0) {
      submitAnswer(null);
      return;
    }
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [phase, secondsLeft, submitAnswer]);

  function advance() {
    if (phase !== 'answered' || !questions) return;
    const next = currentIndex + 1;
    if (next >= questions.length) {
      setPhase('complete');
      return;
    }
    setCurrentIndex(next);
    setSecondsLeft(ROUND_SECONDS);
    setSelectedOption(null);
    setLastResult(null);
    setPhase('active');
  }

  // Tab navigators keep inactive tabs mounted for fast switching, so just changing tabs
  // would leave this screen (and its always-visible-while-allZero modal) alive underneath
  // the Home/Store tab, blocking input there too. Pop this screen off the Quiz stack first
  // so it actually unmounts before handing off to the parent tab navigator.
  const goToStore = () => {
    navigation.popToTop();
    navigation.getParent<BottomTabNavigationProp<RootTabParamList>>()?.navigate('Store');
  };
  const goToHome = () => {
    navigation.popToTop();
    navigation.getParent<BottomTabNavigationProp<RootTabParamList>>()?.navigate('Home');
  };

  if (limits.isLoading) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <QuizLoadingSkeleton roundLabel="True or False" optionCount={2} />
      </SafeAreaView>
    );
  }

  if (allZero) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <OutOfCoinsModal
          visible
          onRequestClose={() => navigation.navigate('QuizHome')}
          onGoToStore={goToStore}
          onBackToHome={goToHome}
        />
      </SafeAreaView>
    );
  }

  if (trueFalseExhausted) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.limitContent}>
          <Card style={styles.limitCard}>
            <Feather name="clock" size={28} color={theme.colors.primary} />
            <Text style={styles.limitTitle}>True/False limit reached</Text>
            <Text style={styles.limitBody}>
              You&rsquo;ve answered 20 True/False questions today. Try Speed Race or Riddles instead - both
              are still available.
            </Text>
          </Card>
          <Button label="Play Speed Race" variant="primary" onPress={() => navigation.navigate('SpeedRace')} />
          <Button label="Play Riddles" variant="secondary" onPress={() => navigation.navigate('Riddles')} />
          <Button label="Back to Quiz" variant="secondary" onPress={() => navigation.navigate('QuizHome')} />
        </View>
      </SafeAreaView>
    );
  }

  if (phase === 'complete') {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.completeContent}>
          <Card style={styles.completeCard}>
            <Text style={styles.completeTitle}>Round complete</Text>
            <Text style={styles.completeXp}>
              {totalXP >= 0 ? '+' : ''}
              {totalXP} XP
            </Text>
            <Text style={styles.completeBody}>Total XP earned this round</Text>
          </Card>
          <Button label="Back to Quiz" variant="primary" onPress={() => navigation.navigate('QuizHome')} />
        </View>
      </SafeAreaView>
    );
  }

  if (questionsQuery.isError) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.limitContent}>
          <Card style={styles.limitCard}>
            <Text style={styles.limitTitle}>Couldn&rsquo;t load questions</Text>
            <Text style={styles.limitBody}>Check your connection and try again.</Text>
          </Card>
          <Button label="Retry" variant="primary" onPress={() => questionsQuery.refetch()} />
          <Button label="Back to Quiz" variant="secondary" onPress={() => navigation.navigate('QuizHome')} />
        </View>
      </SafeAreaView>
    );
  }

  if (questionsQuery.isLoading || !question) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <QuizLoadingSkeleton roundLabel="True or False" optionCount={2} />
      </SafeAreaView>
    );
  }

  const answered = phase === 'answered';
  const earnedThisQuestion = lastResult?.xpEarned ?? 0;

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
          <Pill
            label={question.subject ?? 'General'}
            backgroundColor={theme.colors.bg}
            textColor={theme.colors.inkMuted}
          />
          <TimerBar secondsLeft={secondsLeft} totalSeconds={ROUND_SECONDS} />
        </View>

        <Card style={styles.statementCard}>
          <Text style={theme.type.h3}>{question.questionText}</Text>
        </Card>

        <View style={styles.options}>
          {TRUE_FALSE_OPTIONS.map((value) => {
            const isCorrectOption = value === question.correctAnswer;
            const isSelected = value === selectedOption;

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
              <Pressable key={value} onPress={() => submitAnswer(value)} disabled={phase !== 'active'}>
                <View style={[styles.option, tintStyle]}>
                  <Text style={styles.optionLabel}>{value === 'true' ? 'True' : 'False'}</Text>
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

        {phase === 'submitting' && <ActivityIndicator color={theme.colors.primary} />}

        {answered && (
          <>
            <Text style={[styles.xpFeedback, earnedThisQuestion > 0 ? styles.xpPositive : styles.xpZero]}>
              {earnedThisQuestion >= 0 ? '+' : ''}
              {earnedThisQuestion} XP
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  limitContent: {
    flex: 1,
    padding: theme.spacing.md,
    justifyContent: 'center',
    gap: theme.spacing.md,
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
});
