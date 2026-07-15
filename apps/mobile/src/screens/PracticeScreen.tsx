import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { QuizLoadingSkeleton } from '../components/QuizLoadingSkeleton';
import { theme } from '../theme';
import type { QuizStackParamList } from '../lib/QuizStack';
import { useQuestions, useSubmitAttempt } from '../lib/queries';

const QUESTION_COUNT = 10;

type SelfReport = 'got-it' | 'missed-it';

export default function PracticeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<QuizStackParamList>>();
  const questionsQuery = useQuestions('Practice', QUESTION_COUNT);
  const submitAttempt = useSubmitAttempt();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [complete, setComplete] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);

  const questions = questionsQuery.data;
  const question = questions?.[currentIndex];

  function handleReport(report: SelfReport) {
    if (!question || !questions) return;
    submitAttempt.mutate({ questionId: question.id, selfReportedCorrect: report === 'got-it' });
    const next = currentIndex + 1;
    setReviewedCount((count) => count + 1);
    if (next >= questions.length) {
      setComplete(true);
      return;
    }
    setCurrentIndex(next);
    setRevealed(false);
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
        <QuizLoadingSkeleton roundLabel="Practice" showMeta={false} optionCount={0} actionCount={1} />
      </SafeAreaView>
    );
  }

  if (complete) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.completeContent}>
          <Card style={styles.completeCard}>
            <Text style={styles.completeTitle}>Nice work</Text>
            <Text style={styles.completeCount}>{reviewedCount} cards reviewed</Text>
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
          <Text style={styles.roundLabel}>Practice</Text>
          <View style={styles.headerSpacer} />
        </View>

        {question.roundType === 'ProblemOfDay' ? (
          <Card style={styles.questionCard}>
            <Text style={styles.label}>Problem of the Day</Text>
            <Text style={styles.passageText}>{question.questionText}</Text>
            {revealed && <Text style={styles.answerText}>{question.correctAnswer}</Text>}
          </Card>
        ) : (
          <Card style={styles.questionCard}>
            <Text style={theme.type.h3}>{question.questionText}</Text>
            {revealed && <Text style={styles.answerText}>{question.correctAnswer}</Text>}
          </Card>
        )}

        {!revealed && <Button label="Reveal answer" variant="primary" onPress={() => setRevealed(true)} />}

        {revealed && (
          <View style={styles.reportRow}>
            <Button label="Missed it" variant="secondary" style={styles.reportButton} onPress={() => handleReport('missed-it')} />
            <Button label="Got it" variant="primary" style={styles.reportButton} onPress={() => handleReport('got-it')} />
          </View>
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
  questionCard: {
    minHeight: 96,
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  label: {
    ...theme.type.caption,
    color: theme.colors.inkMuted,
  },
  passageText: {
    ...theme.type.bodyLg,
    color: theme.colors.ink,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  answerText: {
    ...theme.type.bodyMedium,
    color: theme.colors.primary,
  },
  reportRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  reportButton: {
    flex: 1,
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
  completeCount: {
    ...theme.type.body,
    color: theme.colors.inkMuted,
  },
});
