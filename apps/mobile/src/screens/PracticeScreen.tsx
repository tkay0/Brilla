import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { theme } from '../theme';
import type { QuizStackParamList } from '../lib/QuizStack';

type GeneralCard = {
  kind: 'general';
  question: string;
  answer: string;
};

type ProblemOfDayCard = {
  kind: 'potd';
  passage: string;
  answers: string[];
};

type PracticeCard = GeneralCard | ProblemOfDayCard;

// Sample cards until the backend exists - cycled through in order, then practice ends.
// Self-paced and self-graded: no timer, no XP, just a local "Got it" / "Missed it" tally.
const CARDS: PracticeCard[] = [
  {
    kind: 'general',
    question: 'What is the powerhouse of the cell?',
    answer: 'The mitochondrion.',
  },
  {
    kind: 'general',
    question: 'What is the chemical formula for table salt?',
    answer: 'NaCl.',
  },
  {
    kind: 'potd',
    passage:
      'During cellular respiration, pairs of hydrogen atoms are removed from (1) and taken up by (2), which becomes reduced in the process.',
    answers: ['glucose', 'NAD+'],
  },
  {
    kind: 'general',
    question: 'Who is regarded as the father of modern physics?',
    answer: 'Albert Einstein.',
  },
  {
    kind: 'potd',
    passage:
      'In a right-angled triangle, the square of the length of the (1) is equal to the sum of the squares of the lengths of the other (2) sides.',
    answers: ['hypotenuse', 'two'],
  },
];

type SelfReport = 'got-it' | 'missed-it';

export default function PracticeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<QuizStackParamList>>();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [complete, setComplete] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);

  const card = CARDS[currentIndex];

  function handleReport(_report: SelfReport) {
    // Self-report is local only - no visible score, just future personal stats.
    const next = currentIndex + 1;
    setReviewedCount((count) => count + 1);
    if (next >= CARDS.length) {
      setComplete(true);
      return;
    }
    setCurrentIndex(next);
    setRevealed(false);
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

        {card.kind === 'general' ? (
          <Card style={styles.questionCard}>
            <Text style={theme.type.h3}>{card.question}</Text>
            {revealed && <Text style={styles.answerText}>{card.answer}</Text>}
          </Card>
        ) : (
          <Card style={styles.questionCard}>
            <Text style={styles.label}>Problem of the Day</Text>
            <Text style={styles.passageText}>{card.passage}</Text>
            {revealed && (
              <View style={styles.answersList}>
                {card.answers.map((answer, index) => (
                  <Text key={answer} style={styles.answerText}>
                    {index + 1}. {answer}
                  </Text>
                ))}
              </View>
            )}
          </Card>
        )}

        {!revealed && (
          <Button
            label={card.kind === 'general' ? 'Reveal answer' : 'Reveal answers'}
            variant="primary"
            onPress={() => setRevealed(true)}
          />
        )}

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
  answersList: {
    gap: theme.spacing.xs,
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
