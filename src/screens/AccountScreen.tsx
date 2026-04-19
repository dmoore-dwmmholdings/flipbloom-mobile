import React, { useState, useCallback } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Linking,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { signOut } from 'firebase/auth'
import { useFocusEffect } from '@react-navigation/native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { auth, getDocs, query, where, collection, db } from '../lib/firebase'
import { cancelSubscription, createCheckout, purchaseCredits, submitFeedback } from '../lib/api'
import { APP_VERSION } from '../lib/version'
import { useAuth } from '../lib/AuthContext'
import { colors } from '../lib/colors'
import PlanBadge from '../components/PlanBadge'
import type { RootStackParamList } from '../navigation/types'

type Nav = NativeStackNavigationProp<RootStackParamList>

const CREDIT_PACKS = [
  { quantity: 1, label: '1 Credit', price: '$2.99' },
  { quantity: 5, label: '5 Credits', price: '$9.99' },
  { quantity: 15, label: '15 Credits', price: '$24.99' },
]

export default function AccountScreen() {
  const { user, profile, isPro, isMax, refreshProfile } = useAuth()
  const navigation = useNavigation<Nav>()
  const [loading, setLoading] = useState(false)
  const [feedbackVisible, setFeedbackVisible] = useState(false)
  const [feedbackType, setFeedbackType] = useState('general')
  const [feedbackMessage, setFeedbackMessage] = useState('')
  const [feedbackSending, setFeedbackSending] = useState(false)
  const [sessionCount, setSessionCount] = useState(0)

  useFocusEffect(
    useCallback(() => {
      const fetchCounts = async () => {
        if (!user) return
        try {
          const snap = await getDocs(query(collection(db, 'studySessions'), where('uid', '==', user.uid)))
          setSessionCount(snap.size)
        } catch (e) {
          console.error(e)
        }
      }
      void fetchCounts()
    }, [user])
  )

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => signOut(auth),
      },
    ])
  }

  const handleCancelSub = () => {
    Alert.alert(
      'Cancel Subscription',
      'Your access will continue until the end of the billing period.',
      [
        { text: 'Keep Plan', style: 'cancel' },
        {
          text: 'Cancel',
          style: 'destructive',
          onPress: async () => {
            setLoading(true)
            try {
              await cancelSubscription()
              await refreshProfile()
              Alert.alert('Done', 'Subscription canceled.')
            } catch (e) {
              const message = e instanceof Error ? e.message : JSON.stringify(e)
              Alert.alert('Error', message)
            } finally {
              setLoading(false)
            }
          },
        },
      ]
    )
  }

  const handleBuyCredits = async (quantity: number) => {
    setLoading(true)
    try {
      const result = await purchaseCredits({ quantity })
      await Linking.openURL((result as { url: string }).url)
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      Alert.alert('Error', message)
    } finally {
      setLoading(false)
    }
  }

  const handleUpgrade = async (tier: string) => {
    setLoading(true)
    try {
      const result = await createCheckout({
        tier,
        successUrl: 'https://flipbloom.com/dashboard?upgraded=1',
        cancelUrl: 'https://flipbloom.com/pricing',
      })
      console.log('[handleUpgrade] checkout url:', result.url)
      await Linking.openURL(result.url)
    } catch (e) {
      console.error('[handleUpgrade] error:', e)
      const message = e instanceof Error ? e.message : JSON.stringify(e)
      Alert.alert('Checkout Error', message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Account</Text>

        {/* Profile */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Profile</Text>
            {profile && <PlanBadge plan={profile.plan} />}
          </View>
          <Text style={styles.email}>{user?.email}</Text>
        </View>

        {/* Usage */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Usage</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{profile?.deckCount ?? 0}</Text>
              <Text style={styles.statLabel}>Decks</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{profile?.credits ?? 0}</Text>
              <Text style={styles.statLabel}>Credits</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{profile?.aiJudgments ?? 0}</Text>
              <Text style={styles.statLabel}>AI Uses</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{sessionCount}</Text>
              <Text style={styles.statLabel}>Sessions</Text>
            </View>
          </View>
        </View>

        {/* Credits */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Buy Credits</Text>
          <Text style={styles.cardSubtitle}>For AI grading and extra features</Text>
          <View style={styles.creditButtons}>
            {CREDIT_PACKS.map((pack) => (
              <TouchableOpacity
                key={pack.quantity}
                style={styles.creditBtn}
                onPress={() => void handleBuyCredits(pack.quantity)}
                disabled={loading}
              >
                <Text style={styles.creditBtnLabel}>{pack.label}</Text>
                <Text style={styles.creditBtnPrice}>{pack.price}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Subscription */}
        {!isPro ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Upgrade Plan</Text>
            <TouchableOpacity
              style={styles.upgradeBtn}
              onPress={() => navigation.navigate('Pricing')}
            >
              <Text style={styles.upgradeBtnText}>View Plans</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Subscription</Text>
            <Text style={styles.subText}>
              Current plan: <Text style={{ color: isMax ? colors.amber : colors.coral, fontWeight: '700' }}>
                {profile?.plan?.toUpperCase()}
              </Text>
            </Text>
            <TouchableOpacity
              style={[styles.dangerBtn, loading && styles.btnDisabled]}
              onPress={handleCancelSub}
              disabled={loading}
            >
              <Text style={styles.dangerBtnText}>Cancel Subscription</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Actions */}
        <View style={styles.card}>
          <TouchableOpacity style={styles.feedbackBtn} onPress={() => setFeedbackVisible(true)}>
            <Text style={styles.feedbackBtnText}>Send Feedback</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
            <Text style={styles.signOutBtnText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.versionText}>Flipbloom v{APP_VERSION}</Text>
      </ScrollView>

      {/* Feedback modal */}
      <Modal visible={feedbackVisible} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Send Feedback</Text>

              <Text style={styles.fieldLabel}>Type</Text>
              <View style={styles.typeRow}>
                {(['bug', 'feature', 'general'] as const).map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.typeBtn, feedbackType === t && styles.typeBtnActive]}
                    onPress={() => setFeedbackType(t)}
                  >
                    <Text style={[styles.typeBtnText, feedbackType === t && styles.typeBtnTextActive]}>
                      {t === 'bug' ? 'Bug' : t === 'feature' ? 'Feature' : 'General'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Message</Text>
              <TextInput
                style={styles.feedbackInput}
                multiline
                numberOfLines={4}
                placeholder="Tell us what's on your mind..."
                placeholderTextColor={colors.textMuted}
                value={feedbackMessage}
                onChangeText={setFeedbackMessage}
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancel}
                  onPress={() => { setFeedbackVisible(false); setFeedbackMessage(''); setFeedbackType('general') }}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSubmit, (!feedbackMessage.trim() || feedbackSending) && { opacity: 0.5 }]}
                  disabled={!feedbackMessage.trim() || feedbackSending}
                  onPress={async () => {
                    setFeedbackSending(true)
                    try {
                      await submitFeedback({
                        uid: user?.uid,
                        email: user?.email ?? undefined,
                        type: feedbackType,
                        message: feedbackMessage,
                      })
                      setFeedbackVisible(false)
                      setFeedbackMessage('')
                      setFeedbackType('general')
                      Alert.alert('Thanks!', 'Your feedback was submitted.')
                    } catch (e) {
                      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to submit feedback.')
                    } finally {
                      setFeedbackSending(false)
                    }
                  }}
                >
                  <Text style={styles.modalSubmitText}>{feedbackSending ? 'Sending...' : 'Submit'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 20, gap: 14, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: '800', color: colors.text },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  cardSubtitle: { fontSize: 13, color: colors.textMuted },
  email: { fontSize: 15, color: colors.textMuted },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  statItem: { alignItems: 'center', minWidth: 70 },
  statValue: { fontSize: 24, fontWeight: '800', color: colors.coral },
  statLabel: { fontSize: 12, color: colors.textMuted },
  creditButtons: { gap: 8 },
  creditBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  creditBtnLabel: { fontSize: 15, fontWeight: '600', color: colors.text },
  creditBtnPrice: { fontSize: 15, color: colors.coral, fontWeight: '700' },
  upgradeBtn: {
    height: 44,
    backgroundColor: colors.coral,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upgradeBtnText: { fontSize: 15, fontWeight: '700', color: colors.text },
  subText: { fontSize: 14, color: colors.textMuted },
  dangerBtn: {
    height: 44,
    backgroundColor: colors.danger + '22',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.danger,
  },
  dangerBtnText: { fontSize: 15, fontWeight: '700', color: colors.danger },
  btnDisabled: { opacity: 0.5 },
  feedbackBtn: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  feedbackBtnText: { fontSize: 15, fontWeight: '600', color: colors.text },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 16 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  typeBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.bg, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  typeBtnActive: { backgroundColor: 'rgba(237,103,74,0.2)', borderColor: colors.coral },
  typeBtnText: { fontSize: 13, color: colors.textMuted, fontWeight: '500' },
  typeBtnTextActive: { color: colors.coral, fontWeight: '600' },
  feedbackInput: { backgroundColor: colors.bg, borderRadius: 12, padding: 12, color: colors.text, fontSize: 14, minHeight: 100, textAlignVertical: 'top', marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  modalActions: { flexDirection: 'row', gap: 12, justifyContent: 'flex-end' },
  modalCancel: { paddingHorizontal: 16, paddingVertical: 10 },
  modalCancelText: { color: colors.textMuted, fontSize: 14 },
  modalSubmit: { backgroundColor: colors.coral, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  modalSubmitText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  signOutBtn: {
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  signOutBtnText: { fontSize: 15, fontWeight: '600', color: colors.textMuted },
  versionText: { fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: 24 },
})
