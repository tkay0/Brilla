import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { theme } from '../theme';
import type { ProfileStackParamList } from '../lib/ProfileStack';
import { useProfile, useSchools, useUpdateProfile, useUploadAvatar } from '../lib/queries';

export default function EditProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<ProfileStackParamList>>();
  const profile = useProfile();
  const { data: schools, isLoading: schoolsLoading } = useSchools();
  const updateProfile = useUpdateProfile();
  const uploadAvatar = useUploadAvatar();

  const [name, setName] = useState('');
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [schoolQuery, setSchoolQuery] = useState('');
  const [initialized, setInitialized] = useState(false);

  // Profile loads async - seed the form fields once, the first time real data arrives.
  useEffect(() => {
    if (!initialized && profile.data) {
      setName(profile.data.name);
      setSchoolId(profile.data.schoolId);
      setInitialized(true);
    }
  }, [initialized, profile.data]);

  const selectedSchool = useMemo(() => schools?.find((school) => school.id === schoolId) ?? null, [schools, schoolId]);

  const filteredSchools = useMemo(() => {
    const query = schoolQuery.trim().toLowerCase();
    if (!query) return schools ?? [];
    return (schools ?? []).filter((school) => school.name.toLowerCase().includes(query));
  }, [schools, schoolQuery]);

  const canSave = name.trim().length > 0 && !!schoolId && !updateProfile.isPending;

  async function handlePickAvatar() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo access to set a profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    uploadAvatar.mutate(
      { uri: asset.uri, name: asset.fileName ?? 'avatar.jpg', type: asset.mimeType ?? 'image/jpeg' },
      { onError: (error) => Alert.alert('Upload failed', error instanceof Error ? error.message : 'Could not upload your photo. Try again.') },
    );
  }

  function handleSave() {
    if (!canSave || !schoolId) return;
    updateProfile.mutate(
      { name: name.trim(), schoolId },
      {
        onSuccess: () => navigation.goBack(),
        onError: (error) => Alert.alert('Save failed', error instanceof Error ? error.message : 'Could not save your changes. Try again.'),
      },
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Feather name="chevron-left" size={26} color={theme.colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>Edit profile</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.avatarWrap}>
          <Avatar
            label={name || profile.data?.name || ''}
            source={profile.data?.avatarUrl ? { uri: profile.data.avatarUrl } : undefined}
            size={96}
          />
          <Pressable style={styles.cameraBadge} onPress={handlePickAvatar} disabled={uploadAvatar.isPending} hitSlop={8}>
            {uploadAvatar.isPending ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : (
              <Feather name="camera" size={14} color={theme.colors.primary} />
            )}
          </Pressable>
        </View>

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

        <Button
          label={updateProfile.isPending ? 'Saving…' : 'Save changes'}
          variant="primary"
          onPress={handleSave}
          style={{ opacity: canSave ? 1 : 0.5 }}
        />
      </ScrollView>

      <Modal
        visible={pickerOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setPickerOpen(false)}
        onShow={() => setSchoolQuery('')}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setPickerOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <Text style={styles.modalTitle}>Select your school</Text>
            <View style={styles.searchInput}>
              <Feather name="search" size={18} color={theme.colors.inkMuted} />
              <TextInput
                style={styles.searchText}
                placeholder="Search schools"
                placeholderTextColor={theme.colors.inkMuted}
                value={schoolQuery}
                onChangeText={setSchoolQuery}
                autoCapitalize="none"
              />
            </View>
            <FlatList
              data={filteredSchools}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={<Text style={styles.noResults}>No schools match &ldquo;{schoolQuery}&rdquo;</Text>}
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
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
  },
  headerTitle: {
    ...theme.type.h3,
    color: theme.colors.ink,
  },
  headerSpacer: {
    width: 26,
  },
  content: {
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  avatarWrap: {
    position: 'relative',
    alignSelf: 'center',
    marginBottom: theme.spacing.sm,
  },
  cameraBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(20,20,43,0.4)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radii.lg,
    borderTopRightRadius: theme.radii.lg,
    padding: theme.spacing.lg,
    maxHeight: '70%',
  },
  modalTitle: { ...theme.type.h3, color: theme.colors.ink, marginBottom: theme.spacing.sm },
  searchInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.bg,
    borderRadius: theme.radii.sm,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  searchText: {
    flex: 1,
    ...theme.type.body,
    color: theme.colors.ink,
    padding: 0,
  },
  noResults: {
    ...theme.type.body,
    color: theme.colors.inkMuted,
    textAlign: 'center',
    paddingVertical: theme.spacing.md,
  },
  schoolRow: { paddingVertical: theme.spacing.sm },
  schoolName: { ...theme.type.bodyMedium, color: theme.colors.ink },
  schoolRegion: { ...theme.type.caption, color: theme.colors.inkMuted },
});
