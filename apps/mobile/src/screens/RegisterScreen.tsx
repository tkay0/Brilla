import React, { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { Button } from '../components/Button';
import { theme } from '../theme';
import { ApiError } from '../lib/api';
import { useRegister, useSchools } from '../lib/queries';
import type { AuthStackParamList } from '../lib/AuthStack';

export default function RegisterScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const { data: schools, isLoading: schoolsLoading } = useSchools();
  const register = useRegister();

  const [name, setName] = useState('');
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [contact, setContact] = useState('');
  const [password, setPassword] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);

  const selectedSchool = useMemo(() => schools?.find((s) => s.id === schoolId) ?? null, [schools, schoolId]);

  const canSubmit = name.trim().length > 0 && !!schoolId && contact.trim().length > 0 && password.length >= 8;

  const errorMessage =
    register.error instanceof ApiError
      ? register.error.message
      : register.error
        ? 'Something went wrong. Please try again.'
        : null;

  function handleSubmit() {
    if (!canSubmit || !schoolId) return;
    const isEmail = contact.includes('@');
    register.mutate({
      name: name.trim(),
      schoolId,
      password,
      ...(isEmail ? { email: contact.trim() } : { phone: contact.trim() }),
    });
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Create your account</Text>
        <Text style={styles.subtitle}>Join students across Ghana practicing for the NSMQ.</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Your full name"
            placeholderTextColor={theme.colors.inkMuted}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>School</Text>
          <Pressable style={styles.selectInput} onPress={() => setPickerOpen(true)} disabled={schoolsLoading}>
            <Text style={selectedSchool ? styles.selectValue : styles.selectPlaceholder}>
              {schoolsLoading ? 'Loading schools…' : (selectedSchool?.name ?? 'Select your school')}
            </Text>
            <Feather name="chevron-down" size={20} color={theme.colors.inkMuted} />
          </Pressable>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Phone or email</Text>
          <TextInput
            style={styles.input}
            placeholder="020 123 4567 or you@example.com"
            placeholderTextColor={theme.colors.inkMuted}
            value={contact}
            onChangeText={setContact}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="At least 8 characters"
            placeholderTextColor={theme.colors.inkMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </View>

        {errorMessage && <Text style={styles.error}>{errorMessage}</Text>}

        <Button
          label={register.isPending ? 'Creating account…' : 'Create account'}
          onPress={handleSubmit}
          style={{ borderRadius: theme.radii.sm, opacity: canSubmit && !register.isPending ? 1 : 0.5 }}
        />

        <Pressable onPress={() => navigation.navigate('Login')} style={styles.footerLink}>
          <Text style={styles.footerText}>Already have an account? Log in</Text>
        </Pressable>
      </ScrollView>

      <Modal visible={pickerOpen} animationType="slide" transparent onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setPickerOpen(false)}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Select your school</Text>
            <FlatList
              data={schools ?? []}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.schoolRow}
                  onPress={() => {
                    setSchoolId(item.id);
                    setPickerOpen(false);
                  }}
                >
                  <Text style={styles.schoolName}>{item.name}</Text>
                  <Text style={styles.schoolRegion}>{item.region}</Text>
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: theme.spacing.lg, gap: theme.spacing.md },
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
  selectInput: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.sm,
    paddingVertical: theme.spacing.sm + 2,
    paddingHorizontal: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectValue: { ...theme.type.body, color: theme.colors.ink },
  selectPlaceholder: { ...theme.type.body, color: theme.colors.inkMuted },
  error: { ...theme.type.caption, color: theme.colors.accent },
  footerLink: { alignItems: 'center', paddingVertical: theme.spacing.sm },
  footerText: { ...theme.type.bodyMedium, color: theme.colors.primary },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(20,20,43,0.4)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radii.lg,
    borderTopRightRadius: theme.radii.lg,
    padding: theme.spacing.lg,
    maxHeight: '70%',
  },
  modalTitle: { ...theme.type.h3, color: theme.colors.ink, marginBottom: theme.spacing.sm },
  schoolRow: { paddingVertical: theme.spacing.sm },
  schoolName: { ...theme.type.bodyMedium, color: theme.colors.ink },
  schoolRegion: { ...theme.type.caption, color: theme.colors.inkMuted },
});
