import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { colors } from '../lib/colors'

interface PlanBadgeProps {
  plan: 'free' | 'pro' | 'max'
}

export default function PlanBadge({ plan }: PlanBadgeProps) {
  if (plan === 'free') return null

  const badgeColor = plan === 'max' ? colors.amber : colors.coral
  const label = plan === 'max' ? 'MAX' : 'PRO'

  return (
    <View style={[styles.badge, { backgroundColor: badgeColor + '22', borderColor: badgeColor }]}>
      <Text style={[styles.label, { color: badgeColor }]}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
})
