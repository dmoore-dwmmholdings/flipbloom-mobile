import React from 'react'
import { ActivityIndicator, View, StyleSheet } from 'react-native'
import { colors } from '../lib/colors'

interface LoadingSpinnerProps {
  size?: 'small' | 'large'
  fullScreen?: boolean
}

export default function LoadingSpinner({ size = 'large', fullScreen = false }: LoadingSpinnerProps) {
  if (fullScreen) {
    return (
      <View style={styles.fullScreen}>
        <ActivityIndicator size={size} color={colors.coral} />
      </View>
    )
  }
  return <ActivityIndicator size={size} color={colors.coral} />
}

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
