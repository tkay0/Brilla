import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Pill } from '../components/Pill';
import { theme } from '../theme';
import type { QuizStackParamList } from '../lib/QuizStack';

type Question = {
  subject: string;
  question: string;
  options: string[];
  correctIndex: number;
};

// Sample questions until the backend exists - cycled through in order, then the round ends.
const QUESTIONS: Question[] = [
  {
    subject: 'Physics',
    question: 'What is the SI unit of force?',
    options: ['Newton', 'Joule', 'Watt', 'Pascal'],
    correctIndex: 0,
  },
  {
    subject: 'Chemistry',
    question: 'What is the chemical symbol for Gold?',
    options: ['Ag', 'Au', 'Gd', 'Pb'],
    correctIndex: 1,
  },
  {
    subject: 'Biology',
    question: 'Which organelle is known as the powerhouse of the cell?',
    options: ['Nucleus', 'Ribosome', 'Mitochondrion', 'Golgi apparatus'],
    correctIndex: 2,
  },
  {
    subject: 'Mathematics',
    question: 'What is the value of π rounded to 2 decimal places?',
    options: ['3.12', '3.14', '3.16', '3.18'],
    correctIndex: 1,
  },
];

const OPTION_LETTERS = ['A', 'B', 'C', 'D'];
const ROUND_SECONDS = 35;
const XP_PER_CORRECT = 3;
const ADVANCE_DELAY_MS = 1400;

type Phase = 'active' | 'answered' | 'complete';

export default function SpeedRaceScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<QuizStackParamList>>();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(ROUND_SECONDS);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>('active');
  const [totalXP, setTotalXP] = useState(0);

  const question = QUESTIONS[currentIndex];

  // Countdown ticks once per second while a question is active; hitting 0 counts as a
  // no-answer and reveals the correct option same as a wrong tap would.
  useEffect(() => {
    if (phase !== 'active') return;
    if (secondsLeft <= 0) {
      setPhase('answered');
      setSelectedIndex(null);
      return;
    }
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [phase, secondsLeft]);

  // Auto-advance to the next question (or finish the round) a beat after feedback shows.
  useEffect(() => {
    if (phase !== 'answered') return;
    const timer = setTimeout(() => {
      const next = currentIndex + 1;
      if (next >= QUESTIONS.length) {
        setPhase('complete');
        return;
      }
      setCurrentIndex(next);
      setSecondsLeft(ROUND_SECONDS);
      setSelectedIndex(null);
      setPhase('active');
    }, ADVANCE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [phase, currentIndex]);

  function handleSelect(index: number) {
    if (phase !== 'active') return;
    setSelectedIndex(index);
    setPhase('answered');
    if (index === question.correctIndex) {
      setTotalXP((xp) => xp + XP_PER_CORRECT);
    }
  }

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

  const answered = phase === 'answered';
  const earnedThisQuestion = selectedIndex === question.correctIndex ? XP_PER_CORRECT : 0;
  const timerLow = secondsLeft <= 10;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
            <Feather name="chevron-left" size={26} color={theme.colors.ink} />
          </Pressable>
          <Text style={styles.roundLabel}>Speed Race</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.metaRow}>
          <Pill label={question.subject} backgroundColor={theme.colors.bg} textColor={theme.colors.inkMuted} />
          <Pill
            label={`${secondsLeft}s`}
            backgroundColor={timerLow ? theme.colors.accent : theme.colors.bg}
            textColor={timerLow ? theme.colors.surface : theme.colors.inkMuted}
          />
        </View>

        <Card style={styles.questionCard}>
          <Text style={theme.type.h3}>{question.question}</Text>
        </Card>

        <View style={styles.options}>
          {question.options.map((option, index) => {
            const isCorrectOption = index === question.correctIndex;
            const isSelected = index === selectedIndex;

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
              <Pressable key={option} onPress={() => handleSelect(index)} disabled={answered}>
                <View style={[styles.option, tintStyle]}>
                  <View style={styles.optionContent}>
                    <Text style={styles.optionLetter}>{OPTION_LETTERS[index]}</Text>
                    <Text style={styles.optionLabel}>{option}</Text>
                  </View>
                  {answered && isCorrectOption && (
                    <Feather name="check" size={18} color={theme.colors.success} />
                  )}
                  {answered && isSelected && !isCorrectOption && (
                    <Feather name="x" size={18} color={theme.colors.accent} />
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>

        {answered && (
          <Text style={[styles.xpFeedback, earnedThisQuestion > 0 ? styles.xpPositive : styles.xpZero]}>
            +{earnedThisQuestion} XP
          </Text>
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
  },
  questionCard: {
    minHeight: 96,
    justifyContent: 'center',
  },
  options: {
    gap: theme.spacing.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.md,
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
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  optionLetter: {
    ...theme.type.bodyMedium,
    color: theme.colors.inkMuted,
  },
  optionLabel: {
    ...theme.type.bodyMedium,
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
