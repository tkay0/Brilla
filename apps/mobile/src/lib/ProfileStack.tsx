import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ProfileScreen from '../screens/ProfileScreen';
import EditProfileScreen from '../screens/EditProfileScreen';

export type ProfileStackParamList = {
  ProfileHome: undefined;
  EditProfile: undefined;
};

const Stack = createNativeStackNavigator<ProfileStackParamList>();

// Nested stack so "Edit profile" can push a dedicated screen while staying under the
// Profile tab - the tab bar and its icon/tint stay in place, mirroring QuizStack.
export function ProfileStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileHome" component={ProfileScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
    </Stack.Navigator>
  );
}

export default ProfileStack;
