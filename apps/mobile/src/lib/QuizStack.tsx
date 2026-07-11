import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import QuizScreen from '../screens/QuizScreen';
import PracticeScreen from '../screens/PracticeScreen';
import SpeedRaceScreen from '../screens/SpeedRaceScreen';
import TrueOrFalseScreen from '../screens/TrueOrFalseScreen';
import RiddlesScreen from '../screens/RiddlesScreen';

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
      <Stack.Screen name="Practice" component={PracticeScreen} />
      <Stack.Screen name="SpeedRace" component={SpeedRaceScreen} />
      <Stack.Screen name="TrueOrFalse" component={TrueOrFalseScreen} />
      <Stack.Screen name="Riddles" component={RiddlesScreen} />
    </Stack.Navigator>
  );
}

export default QuizStack;
