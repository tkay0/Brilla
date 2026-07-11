import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import QuizScreen from '../screens/QuizScreen';
import { PlaceholderScreen } from '../screens/PlaceholderScreen';

export type QuizStackParamList = {
  QuizHome: undefined;
  Practice: undefined;
  SpeedRace: undefined;
  TrueOrFalse: undefined;
  Riddles: undefined;
};

const Stack = createNativeStackNavigator<QuizStackParamList>();

// Nested stack so tapping a round card can push a dedicated screen while staying under
// the Quiz tab - the tab bar and its icon/tint stay in place.
export function QuizStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="QuizHome" component={QuizScreen} />
      <Stack.Screen name="Practice">{() => <PlaceholderScreen name="Practice" />}</Stack.Screen>
      <Stack.Screen name="SpeedRace">{() => <PlaceholderScreen name="Speed Race" />}</Stack.Screen>
      <Stack.Screen name="TrueOrFalse">{() => <PlaceholderScreen name="True or False" />}</Stack.Screen>
      <Stack.Screen name="Riddles">{() => <PlaceholderScreen name="Riddles" />}</Stack.Screen>
    </Stack.Navigator>
  );
}

export default QuizStack;
