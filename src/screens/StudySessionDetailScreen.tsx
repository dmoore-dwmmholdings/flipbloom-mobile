import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRoute, RouteProp } from '@react-navigation/native'
import { getDoc, doc, db } from '../lib/firebase'
import { colors } from '../lib/colors'
import type { StudySession } from '../lib/types'
import type { RootStackParamList } from '../navigation/types'

type Route = RouteProp<RootStackParamList, 'StudySessionDetail'>

type FilterType = 'all' | 'known' | 'unknown'

export default function StudySessionDetailScreen() {
  const route = useRoute<Route>()
  const { sessionId } = route.params
  const [session, setSession] = useState<StudySession | null>(null)
  const [filter, setFilter] = useState<FilterType>('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const snap = await getDoc(doc(db, 'studySessions', sessionId))
        if (snap.exists()) {
          setSession({ id: snap.id, ...snap.data() } as StudySession)
        }
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    void fetchSession()
  }, [sessionId])

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator style={{ marginTop: 60 }} color={colors.coral} size="large" />
      </SafeAreaView>
    )
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.emptyText}>Session not found.</Text>
      </SafeAreaView>
    )
  }

  const results = session.cardResults ?? []
  const filtered =
    filter === 'known'
      ? results.filter((r) => r.known)
      : filter === 'unknown'
      ? results.filter((r) => !r.known)
      : results

  const date = session.createdAt
    ? new Date(((session.createdAt as { seconds?: number }).seconds ?? 0) * 1000).toLocaleDateString()
    : '—'

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.sessionInfo}>
        <Text style={styles.deckTitle}>{session.deckTitle}</Text>
        <Text style={styles.sessionDate}>{date}</Text>
        <View style={styles.statRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{session.knownCount}</Text>
            <Text style={styles.statLabel}>Known</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, styles.unknownValue]}>{session.unknownCount}</Text>
            <Text style={styles.statLabel}>Studying</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{session.totalCards}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
        </View>
      </View>

      {results.length > 0 ? (
        <>
          <View style={styles.filterRow}>
            {(['all', 'known', 'unknown'] as FilterType[]).map((f) => (
              <TouchableOpacity
                key={f}
                style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
                onPress={() => setFilter(f)}
              >
                <Text style={[styles.filterBtnText, filter === f && styles.filterBtnTextActive]}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                  {f === 'known' ? ` (${results.filter((r) => r.known).length})` : ''}
                  {f === 'unknown' ? ` (${results.filter((r) => !r.known).length})` : ''}
                  {f === 'all' ? ` (${results.length})` : ''}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <FlatList
            data={filtered}
            keyExtractor={(item, idx) => `${item.cardId}-${idx}`}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <View style={[styles.resultItem, item.known ? styles.resultKnown : styles.resultUnknown]}>
                <View style={styles.resultContent}>
                  <Text style={styles.resultFront} numberOfLines={2}>{item.front}</Text>
                  <Text style={styles.resultBack} numberOfLines={1}>{item.back}</Text>
                </View>
                <View style={[styles.badge, item.known ? styles.badgeKnown : styles.badgeUnknown]}>
                  <Text style={[styles.badgeText, item.known ? styles.badgeTextKnown : styles.badgeTextUnknown]}>
                    {item.known ? 'Known' : 'Learning'}
                  </Text>
                </View>
              </View>
            )}
          />
        </>
      ) : (
        <Text style={styles.emptyText}>No per-card data for this session.</Text>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  sessionInfo: {
    backgroundColor: colors.surface,
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 4,
  },
  deckTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  sessionDate: { fontSize: 13, color: colors.textMuted },
  statRow: { flexDirection: 'row', gap: 24, marginTop: 12 },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '800', color: colors.coral },
  unknownValue: { color: colors.danger },
  statLabel: { fontSize: 12, color: colors.textMuted },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    padding: 16,
    paddingBottom: 8,
  },
  filterBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  filterBtnActive: { borderColor: colors.coral, backgroundColor: colors.coral + '22' },
  filterBtnText: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  filterBtnTextActive: { color: colors.coral },
  list: { padding: 16, gap: 8, paddingBottom: 40 },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: colors.surface,
    gap: 10,
  },
  resultKnown: { borderColor: '#4ade8033' },
  resultUnknown: { borderColor: colors.danger + '33' },
  resultContent: { flex: 1, gap: 4 },
  resultFront: { fontSize: 14, fontWeight: '600', color: colors.text },
  resultBack: { fontSize: 13, color: colors.textMuted },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeKnown: { backgroundColor: '#4ade8022' },
  badgeUnknown: { backgroundColor: colors.danger + '22' },
  badgeText: { fontSize: 12, fontWeight: '700' },
  badgeTextKnown: { color: '#4ade80' },
  badgeTextUnknown: { color: colors.danger },
  emptyText: { textAlign: 'center', color: colors.textMuted, marginTop: 40, fontSize: 15 },
})
