import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/HomeScreen';
import HallOfFameScreen from '../screens/HallOfFameScreen';

export type HomeStackParamList = {
  HomeHome: undefined;
  HallOfFame: undefined;
};

const Stack = createNativeStackNavigator<HomeStackParamList>();

// Nested stack so "All >" on the Hall of Fame section can push a dedicated screen while
// staying under the Home tab, mirroring QuizStack/ProfileStack.
export function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HomeHome" component={HomeScreen} />
      <Stack.Screen name="HallOfFame" component={HallOfFameScreen} />
    </Stack.Navigator>
  );
}

export default HomeStack;
