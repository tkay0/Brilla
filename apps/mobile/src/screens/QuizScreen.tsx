import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { Card } from '../components/Card';
import { Header } from '../components/Header';
import { HeaderStatus } from '../components/HeaderStatus';
import { Pill } from '../components/Pill';
import { theme } from '../theme';
import type { QuizStackParamList } from '../lib/QuizStack';
import { SAMPLE_HEADER_USER } from '../lib/sampleData';

type Round = {
  route: keyof QuizStackParamList;
  icon: keyof typeof Feather.glyphMap;
  title: string;
  description: string;
  tag: string;
};

const ROUNDS: Round[] = [
  {
    route: 'Practice',
    icon: 'book-open',
    title: 'Practice',
    description: 'General + Problem of the Day',
    tag: 'Self-paced',
  },
  {
    route: 'SpeedRace',
    icon: 'zap',
    title: 'Speed Race',
    description: 'Rapid-fire, race the clock',
    tag: '35s',
  },
  {
    route: 'TrueOrFalse',
    icon: 'check-circle',
    title: 'True or False',
    description: 'Quick calls, high pressure',
    tag: '15s',
  },
  {
    route: 'Riddles',
    icon: 'help-circle',
    title: 'Riddles',
    description: '4 clues, deduce the answer',
    tag: '30s',
  },
];

export default function QuizScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<QuizStackParamList>>();

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Header right={<HeaderStatus {...SAMPLE_HEADER_USER} />} />
        <Text style={styles.title}>Quiz</Text>

        {ROUNDS.map((round) => (
          <Pressable key={round.route} onPress={() => navigation.navigate(round.route)}>
            <Card style={styles.card}>
              <View style={styles.cardHeader}>
                <Feather name={round.icon} size={24} color={theme.colors.primary} />
                <View style={styles.cardHeaderText}>
                  <Text style={theme.type.h3}>{round.title}</Text>
                  <Text style={styles.body}>{round.description}</Text>
                </View>
              </View>
              <Pill
                label={round.tag}
                backgroundColor={theme.colors.bg}
                textColor={theme.colors.inkMuted}
                style={styles.tag}
              />
            </Card>
          </Pressable>
        ))}
      </ScrollView>
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
  card: {
    gap: theme.spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
  },
  cardHeaderText: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  body: {
    ...theme.type.body,
    color: theme.colors.inkMuted,
  },
  tag: {
    marginLeft: 24 + theme.spacing.sm,
  },
});
