import React from 'react'
import { View, ActivityIndicator, StyleSheet } from 'react-native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useAuth } from '../lib/AuthContext'
import { colors } from '../lib/colors'
import type { RootStackParamList } from './types'

import TabNavigator from './TabNavigator'
import LoginScreen from '../screens/LoginScreen'
import DeckScreen from '../screens/DeckScreen'
import StudyScreen from '../screens/StudyScreen'
import QuizSetupScreen from '../screens/QuizSetupScreen'
import QuizSessionScreen from '../screens/QuizSessionScreen'
import QuizResultsScreen from '../screens/QuizResultsScreen'
import StudySessionDetailScreen from '../screens/StudySessionDetailScreen'
import PricingScreen from '../screens/PricingScreen'
import StudyGuideViewScreen from '../screens/StudyGuideViewScreen'
import StudyCompleteScreen from '../screens/StudyCompleteScreen'

const Stack = createNativeStackNavigator<RootStackParamList>()

export default function RootNavigator() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.coral} />
      </View>
    )
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!user ? (
        <Stack.Screen name="Login" component={LoginScreen} />
      ) : (
        <>
          <Stack.Screen name="Main" component={TabNavigator} />
          <Stack.Screen
            name="Deck"
            component={DeckScreen}
            options={{
              headerShown: true,
              headerStyle: { backgroundColor: colors.surface },
              headerTintColor: colors.text,
              headerBackTitle: '',
            }}
          />
          <Stack.Screen
            name="Study"
            component={StudyScreen}
            options={{
              headerShown: true,
              headerStyle: { backgroundColor: colors.bg },
              headerTintColor: colors.text,
              headerBackTitle: '',
              title: 'Study',
            }}
          />
          <Stack.Screen
            name="QuizSetup"
            component={QuizSetupScreen}
            options={{
              headerShown: true,
              headerStyle: { backgroundColor: colors.bg },
              headerTintColor: colors.text,
              headerBackTitle: '',
              title: 'Quiz Setup',
            }}
          />
          <Stack.Screen
            name="QuizSession"
            component={QuizSessionScreen}
            options={{
              headerShown: true,
              headerStyle: { backgroundColor: colors.bg },
              headerTintColor: colors.text,
              headerBackTitle: '',
              title: 'Quiz',
            }}
          />
          <Stack.Screen
            name="QuizResults"
            component={QuizResultsScreen}
            options={{
              headerShown: true,
              headerStyle: { backgroundColor: colors.bg },
              headerTintColor: colors.text,
              headerBackTitle: '',
              title: 'Results',
            }}
          />
          <Stack.Screen
            name="StudySessionDetail"
            component={StudySessionDetailScreen}
            options={{
              headerShown: true,
              headerStyle: { backgroundColor: colors.bg },
              headerTintColor: colors.text,
              headerBackTitle: '',
              title: 'Session Detail',
            }}
          />
          <Stack.Screen
            name="Pricing"
            component={PricingScreen}
            options={{
              headerShown: true,
              headerStyle: { backgroundColor: colors.bg },
              headerTintColor: colors.text,
              headerBackTitle: '',
              title: 'Upgrade',
            }}
          />
          <Stack.Screen
            name="StudyGuideView"
            component={StudyGuideViewScreen}
            options={{
              headerShown: true,
              headerStyle: { backgroundColor: colors.bg },
              headerTintColor: colors.text,
              headerBackTitle: '',
              title: 'Study Guide',
            }}
          />
          <Stack.Screen
            name="StudyComplete"
            component={StudyCompleteScreen}
            options={{ headerShown: false }}
          />
        </>
      )}
    </Stack.Navigator>
  )
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
