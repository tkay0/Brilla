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

type Riddle = {
  subject: string;
  clues: string[];
  options: string[];
  correctIndex: number;
};

// Sample riddles until the backend exists - cycled through in order, then the round ends.
// All 4 clues are shown together (not progressively revealed) by deliberate earlier decision.
const RIDDLES: Riddle[] = [
  {
    subject: 'Geography',
    clues: [
      'I am the largest country by land area.',
      'I span eleven time zones.',
      'My capital is Moscow.',
      'I border more countries than any other nation.',
    ],
    options: ['Canada', 'China', 'Russia', 'Brazil'],
    correctIndex: 2,
  },
  {
    subject: 'Science',
    clues: [
      'I am a state of matter.',
      'I have no fixed shape or volume.',
      'I expand to fill my container.',
      'Air is made mostly of me.',
    ],
    options: ['Solid', 'Liquid', 'Plasma', 'Gas'],
    correctIndex: 3,
  },
  {
    subject: 'History',
    clues: [
      'I was a wonder of the ancient world.',
      'I was built as a tomb.',
      'I am located near Cairo.',
      'I am the only ancient wonder still standing.',
    ],
    options: ['The Colosseum', 'The Great Pyramid of Giza', 'The Parthenon', 'Stonehenge'],
    correctIndex: 1,
  },
  {
    subject: 'Mathematics',
    clues: [
      'I am a number.',
      'I am neither positive nor negative.',
      'I am the additive identity.',
      'Any number multiplied by me equals me.',
    ],
    options: ['One', 'Negative one', 'Zero', 'Infinity'],
    correctIndex: 2,
  },
];

const OPTION_LETTERS = ['A', 'B', 'C', 'D'];
const ROUND_SECONDS = 30;
const XP_PER_CORRECT = 3;

export default function RiddlesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<QuizStackParamList>>();
  const {
    question: riddle,
    secondsLeft,
    phase,
    selectedAnswer: selectedIndex,
    totalXP,
    answered,
    earnedThisQuestion,
    submitAnswer: handleSelect,
    advance,
  } = useTimedRound<Riddle, number>({
    questions: RIDDLES,
    roundSeconds: ROUND_SECONDS,
    xpPerCorrect: XP_PER_CORRECT,
    isCorrect: (r, answer) => answer === r.correctIndex,
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
          <Text style={styles.roundLabel}>Riddles</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.metaRow}>
          <Pill label={riddle.subject} backgroundColor={theme.colors.bg} textColor={theme.colors.inkMuted} />
          <TimerBar secondsLeft={secondsLeft} totalSeconds={ROUND_SECONDS} />
        </View>

        <Card style={styles.cluesCard}>
          {riddle.clues.map((clue, index) => (
            <Text key={clue} style={styles.clueText}>
              {index + 1}. {clue}
            </Text>
          ))}
        </Card>

        <View style={styles.options}>
          {riddle.options.map((option, index) => {
            const isCorrectOption = index === riddle.correctIndex;
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
  cluesCard: {
    gap: theme.spacing.xs,
  },
  clueText: {
    ...theme.type.body,
    color: theme.colors.ink,
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
