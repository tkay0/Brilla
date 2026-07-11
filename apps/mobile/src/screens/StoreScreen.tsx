import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Pill } from '../components/Pill';
import { theme } from '../theme';

// Sample data until Paystack + a real wallet balance exist.
const COIN_BALANCE = '640';

const PASS = {
  title: 'Premium Pass',
  description: '30 days, unlimited practice',
  price: 'GHS 20',
};

type CoinPack = {
  coins: string;
  price: string;
};

const COIN_PACKS: CoinPack[] = [
  { coins: '500 coins', price: 'GHS 5' },
  { coins: '1,200 coins', price: 'GHS 10' },
  { coins: '3,000 coins', price: 'GHS 20' },
];

export default function StoreScreen() {
  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Store</Text>
          <Pill label={`🪙 ${COIN_BALANCE}`} backgroundColor={theme.colors.primary} textColor={theme.colors.surface} />
        </View>

        <Card style={styles.passCard}>
          <Text style={styles.passTitle}>{PASS.title}</Text>
          <Text style={styles.passDescription}>{PASS.description}</Text>
          <View style={styles.passFooter}>
            <Text style={styles.passPrice}>{PASS.price}</Text>
            <Button label="Get pass" variant="secondary" onPress={() => {}} />
          </View>
        </Card>

        <Text style={styles.sectionLabel}>COIN PACKS</Text>

        {COIN_PACKS.map((pack) => (
          <Card key={pack.coins} style={styles.packCard}>
            <View style={styles.packInfo}>
              <Text style={styles.packCoinIcon}>🪙</Text>
              <Text style={styles.packCoins}>{pack.coins}</Text>
            </View>
            <View style={styles.packFooter}>
              <Text style={styles.packPrice}>{pack.price}</Text>
              <Button label="Buy" variant="primary" onPress={() => {}} />
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
  content: {
    padding: theme.spacing.md,
    gap: theme.spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    ...theme.type.h1,
    color: theme.colors.ink,
  },
  passCard: {
    backgroundColor: theme.colors.primary,
    gap: theme.spacing.xs,
  },
  passTitle: {
    ...theme.type.h3,
    color: theme.colors.surface,
  },
  passDescription: {
    ...theme.type.body,
    color: theme.colors.surface,
    opacity: 0.85,
  },
  passFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: theme.spacing.sm,
  },
  passPrice: {
    ...theme.type.h2,
    color: theme.colors.surface,
  },
  sectionLabel: {
    ...theme.type.caption,
    fontFamily: theme.fonts.bodyMedium,
    color: theme.colors.inkMuted,
    letterSpacing: 1,
  },
  packCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  packInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  packCoinIcon: {
    fontSize: 24,
  },
  packCoins: {
    ...theme.type.bodyMedium,
    color: theme.colors.ink,
  },
  packFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  packPrice: {
    ...theme.type.bodyMedium,
    color: theme.colors.inkMuted,
  },
});
