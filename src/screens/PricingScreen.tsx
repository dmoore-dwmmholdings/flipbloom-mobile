import React, { useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Check } from 'lucide-react-native'
import { createCheckout } from '../lib/api'
import { useAuth } from '../lib/AuthContext'
import { colors } from '../lib/colors'

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: '',
    color: colors.textMuted,
    features: [
      'Up to 3 decks',
      '20 cards per deck',
      'Basic study mode',
      'Basic quizzes',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$9.99',
    period: '/mo',
    color: colors.coral,
    features: [
      'Up to 15 decks',
      'Unlimited cards',
      'AI quiz grading',
      '1 study guide/month',
      'Topic organization',
      'Progress tracking',
    ],
  },
  {
    id: 'max',
    name: 'Max',
    price: '$19.99',
    period: '/mo',
    color: colors.amber,
    features: [
      'Up to 50 decks',
      'Unlimited cards',
      'AI quiz grading',
      '5 study guides/month',
      'Priority AI generation',
      'Everything in Pro',
    ],
  },
]

export default function PricingScreen() {
  const { profile } = useAuth()
  const [loading, setLoading] = useState<string | null>(null)

  const handleUpgrade = async (tier: string) => {
    if (tier === 'free') return
    setLoading(tier)
    try {
      const result = await createCheckout({
        tier,
        successUrl: 'flipbloom://upgrade-success',
        cancelUrl: 'flipbloom://account',
      })
      await Linking.openURL(result.url)
    } catch (e) {
      const err = e as Error
      Alert.alert('Error', err.message)
    } finally {
      setLoading(null)
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Choose Your Plan</Text>
        <Text style={styles.subtitle}>Unlock the full Flipbloom experience</Text>

        {PLANS.map((plan) => {
          const isCurrent = profile?.plan === plan.id
          return (
            <View
              key={plan.id}
              style={[styles.planCard, isCurrent && { borderColor: plan.color, borderWidth: 2 }]}
            >
              {isCurrent ? (
                <View style={[styles.currentBadge, { backgroundColor: plan.color + '22' }]}>
                  <Text style={[styles.currentBadgeText, { color: plan.color }]}>Current Plan</Text>
                </View>
              ) : null}

              <View style={styles.planHeader}>
                <Text style={[styles.planName, { color: plan.color }]}>{plan.name}</Text>
                <View style={styles.priceRow}>
                  <Text style={styles.planPrice}>{plan.price}</Text>
                  {plan.period ? <Text style={styles.planPeriod}>{plan.period}</Text> : null}
                </View>
              </View>

              <View style={styles.featureList}>
                {plan.features.map((f, idx) => (
                  <View key={idx} style={styles.featureRow}>
                    <Check size={16} color={plan.color} />
                    <Text style={styles.featureText}>{f}</Text>
                  </View>
                ))}
              </View>

              {plan.id !== 'free' && !isCurrent ? (
                <TouchableOpacity
                  style={[styles.upgradeBtn, { backgroundColor: plan.color }, loading === plan.id && styles.btnDisabled]}
                  onPress={() => void handleUpgrade(plan.id)}
                  disabled={loading !== null}
                >
                  {loading === plan.id
                    ? <ActivityIndicator size="small" color={colors.text} />
                    : <Text style={styles.upgradeBtnText}>Upgrade to {plan.name}</Text>
                  }
                </TouchableOpacity>
              ) : null}
            </View>
          )
        })}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 20, gap: 16, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: '800', color: colors.text, textAlign: 'center' },
  subtitle: { fontSize: 15, color: colors.textMuted, textAlign: 'center', marginBottom: 8 },
  planCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 14,
  },
  currentBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  currentBadgeText: { fontSize: 12, fontWeight: '700' },
  planHeader: { gap: 4 },
  planName: { fontSize: 22, fontWeight: '800' },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  planPrice: { fontSize: 28, fontWeight: '800', color: colors.text },
  planPeriod: { fontSize: 14, color: colors.textMuted },
  featureList: { gap: 10 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  featureText: { fontSize: 14, color: colors.text, flex: 1 },
  upgradeBtn: {
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upgradeBtnText: { fontSize: 15, fontWeight: '700', color: colors.text },
  btnDisabled: { opacity: 0.6 },
})
