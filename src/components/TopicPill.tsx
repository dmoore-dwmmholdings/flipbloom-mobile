import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { colors } from '../lib/colors'

interface TopicPillProps {
  name: string
  color?: string
}

export default function TopicPill({ name, color = colors.coral }: TopicPillProps) {
  return (
    <View style={[styles.pill, { backgroundColor: color + '22', borderColor: color + '55' }]}>
      <Text style={[styles.label, { color }]}>{name}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
})
