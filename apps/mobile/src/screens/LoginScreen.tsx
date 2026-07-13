import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button } from '../components/Button';
import { theme } from '../theme';
import { ApiError } from '../lib/api';
import { useLogin } from '../lib/queries';
import type { AuthStackParamList } from '../lib/AuthStack';

export default function LoginScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const login = useLogin();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  const canSubmit = identifier.trim().length > 0 && password.length > 0;

  const errorMessage =
    login.error instanceof ApiError
      ? login.error.message
      : login.error
        ? 'Something went wrong. Please try again.'
        : null;

  function handleSubmit() {
    if (!canSubmit) return;
    login.mutate({ identifier: identifier.trim(), password });
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Log in to keep your streak going.</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Phone or email</Text>
          <TextInput
            style={styles.input}
            placeholder="020 123 4567 or you@example.com"
            placeholderTextColor={theme.colors.inkMuted}
            value={identifier}
            onChangeText={setIdentifier}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Your password"
            placeholderTextColor={theme.colors.inkMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </View>

        {errorMessage && <Text style={styles.error}>{errorMessage}</Text>}

        <Button
          label={login.isPending ? 'Logging in…' : 'Log In'}
          onPress={handleSubmit}
          style={{ borderRadius: theme.radii.sm, opacity: canSubmit && !login.isPending ? 1 : 0.5 }}
        />

        <Pressable onPress={() => navigation.navigate('Register')} style={styles.footerLink}>
          <Text style={styles.footerText}>New here? Create an account</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: theme.spacing.lg, gap: theme.spacing.md, flexGrow: 1 },
  title: { ...theme.type.h1, color: theme.colors.ink },
  subtitle: { ...theme.type.body, color: theme.colors.inkMuted, marginBottom: theme.spacing.sm },
  field: { gap: theme.spacing.xs },
  label: { ...theme.type.bodyMedium, color: theme.colors.ink },
  input: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.sm,
    paddingVertical: theme.spacing.sm + 2,
    paddingHorizontal: theme.spacing.md,
    ...theme.type.body,
    color: theme.colors.ink,
  },
  error: { ...theme.type.caption, color: theme.colors.accent },
  footerLink: { alignItems: 'center', paddingVertical: theme.spacing.sm },
  footerText: { ...theme.type.bodyMedium, color: theme.colors.primary },
});
