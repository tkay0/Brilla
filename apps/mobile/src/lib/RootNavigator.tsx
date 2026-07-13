import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';
import HomeScreen from '../screens/HomeScreen';
import QuizStack from './QuizStack';
import LeaderboardScreen from '../screens/LeaderboardScreen';
import StoreScreen from '../screens/StoreScreen';
import ProfileScreen from '../screens/ProfileScreen';
import AuthStack from './AuthStack';
import { loadToken, useAuthToken } from './authStore';
import { theme } from '../theme';

export type RootTabParamList = {
  Home: undefined;
  Quiz: undefined;
  Leaderboard: undefined;
  Store: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

// Feather is the closest stylistic match to Tabler icons available in @expo/vector-icons -
// minimal, consistent single-stroke outline glyphs.
const TAB_ICONS: Record<keyof RootTabParamList, keyof typeof Feather.glyphMap> = {
  Home: 'home',
  Quiz: 'help-circle',
  Leaderboard: 'award',
  Store: 'shopping-bag',
  Profile: 'user',
};

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.inkMuted,
        // Flat tab bar, consistent with the rest of the app: no border, no shadow.
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopWidth: 0,
          elevation: theme.elevation.none,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: {
          fontFamily: theme.fonts.bodyMedium,
          fontSize: 10,
        },
        tabBarIcon: ({ color, size }) => (
          <Feather name={TAB_ICONS[route.name as keyof RootTabParamList]} color={color} size={size} />
        ),
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Quiz" component={QuizStack} />
      <Tab.Screen name="Leaderboard" component={LeaderboardScreen} />
      <Tab.Screen name="Store" component={StoreScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const token = useAuthToken();

  useEffect(() => {
    loadToken();
  }, []);

  if (token === undefined) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.bg }}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  return <NavigationContainer>{token ? <MainTabs /> : <AuthStack />}</NavigationContainer>;
}

export default RootNavigator;
