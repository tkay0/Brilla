import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { Avatar } from '../components/Avatar';
import { Card } from '../components/Card';
import { theme } from '../theme';
import type { HomeStackParamList } from '../lib/HomeStack';
import { HALL_OF_FAME, SCHOOL_IMAGES } from '../lib/hallOfFame';

export default function HallOfFameScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<HomeStackParamList>>();

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Feather name="chevron-left" size={24} color={theme.colors.ink} />
        </Pressable>
        <Text style={styles.title}>Hall of Fame</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {HALL_OF_FAME.map((entry) => (
          <Card key={entry.name} style={styles.card}>
            <Avatar label={entry.name} source={SCHOOL_IMAGES[entry.imageKey]} size={64} />
            <View style={styles.info}>
              <Text style={styles.name}>{entry.name}</Text>
              <Text style={styles.titles}>
                {entry.titles} title{entry.titles > 1 ? 's' : ''}
              </Text>
              <Text style={styles.years}>Years: {entry.years.join(', ')}</Text>
            </View>
          </Card>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  headerSpacer: {
    width: 24,
  },
  title: {
    ...theme.type.h2,
    color: theme.colors.ink,
  },
  content: {
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    ...theme.type.h3,
    color: theme.colors.ink,
  },
  titles: {
    ...theme.type.bodyMedium,
    color: theme.colors.primary,
  },
  years: {
    ...theme.type.caption,
    color: theme.colors.inkMuted,
  },
});
