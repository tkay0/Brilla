import React from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Button } from './Button';
import { Card } from './Card';
import { theme } from '../theme';

type OutOfCoinsModalProps = {
  visible: boolean;
  onGoToStore: () => void;
  onBackToHome: () => void;
  onRequestClose: () => void;
};

// Reusable overlay shown when a user hits their question limit. Trigger logic (real
// limit-tracking) comes later with the coins backend work - this only handles presentation.
export function OutOfCoinsModal({ visible, onGoToStore, onBackToHome, onRequestClose }: OutOfCoinsModalProps) {
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onRequestClose}>
      <View style={styles.backdrop}>
        <Card style={styles.card}>
          <View style={styles.iconWrap}>
            <Feather name="zap-off" size={28} color={theme.colors.primary} />
          </View>
          <Text style={styles.title}>Out of coins</Text>
          <Text style={styles.body}>
            You've reached your question limit for now. Top up your coins to keep practicing.
          </Text>
          <View style={styles.buttons}>
            <Button label="Go to Store" onPress={onGoToStore} />
            <Button label="Back to Home" variant="secondary" onPress={onBackToHome} />
          </View>
        </Card>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(20,20,43,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.xs,
  },
  title: {
    ...theme.type.h2,
    color: theme.colors.ink,
  },
  body: {
    ...theme.type.body,
    color: theme.colors.inkMuted,
    textAlign: 'center',
  },
  buttons: {
    width: '100%',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
});

export default OutOfCoinsModal;
