import React from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { BookOpen, Zap, BarChart2, BookMarked, User } from 'lucide-react-native'
import { colors } from '../lib/colors'
import { useAuth } from '../lib/AuthContext'
import type { TabParamList, RootStackParamList } from './types'

import DashboardScreen from '../screens/DashboardScreen'
import GenerateScreen from '../screens/GenerateScreen'
import ProgressScreen from '../screens/ProgressScreen'
import StudyGuidesScreen from '../screens/StudyGuidesScreen'
import AccountScreen from '../screens/AccountScreen'

const Tab = createBottomTabNavigator<TabParamList>()

function GuidesTabWrapper() {
  return <StudyGuidesScreen />
}

export default function TabNavigator() {
  const { isPro } = useAuth()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 60,
        },
        tabBarActiveTintColor: colors.coral,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 11, marginBottom: 4 },
      }}
    >
      <Tab.Screen
        name="Library"
        component={DashboardScreen}
        options={{
          tabBarIcon: ({ color, size }) => <BookOpen color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Generate"
        component={GenerateScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Zap color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Progress"
        component={ProgressScreen}
        options={{
          tabBarIcon: ({ color, size }) => <BarChart2 color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Guides"
        component={GuidesTabWrapper}
        listeners={{
          tabPress: (e) => {
            if (!isPro) {
              e.preventDefault()
              navigation.navigate('Pricing')
            }
          },
        }}
        options={{
          tabBarIcon: ({ color, size }) => <BookMarked color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Account"
        component={AccountScreen}
        options={{
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
    </Tab.Navigator>
  )
}
