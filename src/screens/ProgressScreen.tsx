import React, { useState, useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  SectionList,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation, useFocusEffect } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getDocs, query, where, collection, db } from '../lib/firebase'
import { useAuth } from '../lib/AuthContext'
import { colors } from '../lib/colors'
import type { StudySession, QuizSession } from '../lib/types'
import type { RootStackParamList } from '../navigation/types'

type Nav = NativeStackNavigationProp<RootStackParamList>

export default function ProgressScreen() {
  const { user } = useAuth()
  const navigation = useNavigation<Nav>()
  const [studySessions, setStudySessions] = useState<StudySession[]>([])
  const [quizSessions, setQuizSessions] = useState<QuizSession[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = useCallback(async () => {
    if (!user) return
    try {
      const [studySnap, quizSnap] = await Promise.all([
        getDocs(query(collection(db, 'studySessions'), where('uid', '==', user.uid))),
        getDocs(query(collection(db, 'quizSessions'), where('uid', '==', user.uid))),
      ])
      const studyList = studySnap.docs
        .map((d) => ({ id: d.id, ...d.data() } as StudySession))
        .sort((a, b) => {
          const aTime = (a.createdAt as { seconds?: number })?.seconds ?? 0
          const bTime = (b.createdAt as { seconds?: number })?.seconds ?? 0
          return bTime - aTime
        })
      const quizList = quizSnap.docs
        .map((d) => ({ id: d.id, ...d.data() } as QuizSession))
        .sort((a, b) => {
          const aTime = (a.createdAt as { seconds?: number })?.seconds ?? 0
          const bTime = (b.createdAt as { seconds?: number })?.seconds ?? 0
          return bTime - aTime
        })
      setStudySessions(studyList)
      setQuizSessions(quizList)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [user])

  useFocusEffect(
    useCallback(() => {
      void fetchData()
    }, [fetchData])
  )

  const onRefresh = () => {
    setRefreshing(true)
    void fetchData()
  }

  const formatDate = (createdAt: unknown) => {
    const secs = (createdAt as { seconds?: number })?.seconds ?? 0
    return new Date(secs * 1000).toLocaleDateString()
  }

  type SectionData =
    | { type: 'study'; data: StudySession[] }
    | { type: 'quiz'; data: QuizSession[] }

  const sections: { title: string; data: (StudySession | QuizSession)[]; type: 'study' | 'quiz' }[] = [
    { title: 'Study Sessions', data: studySessions, type: 'study' },
    { title: 'Quiz Sessions', data: quizSessions, type: 'quiz' },
  ]

  return (
    <SafeAreaView style={styles.safe}>
      <Text style={styles.pageTitle}>Progress</Text>
      <SectionList
        sections={sections}
        keyExtractor={(item) => (item as StudySession | QuizSession).id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.coral} />}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionTitle}>{section.title}</Text>
        )}
        renderItem={({ item, section }) => {
          if (section.type === 'study') {
            const s = item as StudySession
            return (
              <TouchableOpacity
                style={styles.sessionCard}
                onPress={() => navigation.navigate('StudySessionDetail', { sessionId: s.id })}
              >
                <View style={styles.sessionLeft}>
                  <Text style={styles.sessionTitle} numberOfLines={1}>{s.deckTitle}</Text>
                  <Text style={styles.sessionDate}>{formatDate(s.createdAt)}</Text>
                  <View style={styles.knownRow}>
                    <View style={styles.knownBadge}>
                      <Text style={styles.knownText}>Known: {s.knownCount}</Text>
                    </View>
                    <View style={styles.unknownBadge}>
                      <Text style={styles.unknownText}>Studying: {s.unknownCount}</Text>
                    </View>
                  </View>
                </View>
                <Text style={styles.sessionPct}>
                  {Math.round((s.knownCount / (s.totalCards || 1)) * 100)}%
                </Text>
              </TouchableOpacity>
            )
          } else {
            const q = item as QuizSession
            return (
              <View style={styles.sessionCard}>
                <View style={styles.sessionLeft}>
                  <Text style={styles.sessionTitle} numberOfLines={1}>{q.quizTitle}</Text>
                  <Text style={styles.sessionDate}>{formatDate(q.createdAt)}</Text>
                </View>
                <Text style={[styles.sessionPct, q.score / (q.totalQuestions || 1) >= 0.7 ? styles.scorePctGood : styles.scorePctBad]}>
                  {Math.round((q.score / (q.totalQuestions || 1)) * 100)}%
                </Text>
              </View>
            )
          }
        }}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>Nothing here yet</Text>
              <Text style={styles.emptyText}>Complete a study session or quiz and it will show up here.</Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  pageTitle: { fontSize: 26, fontWeight: '800', color: colors.text, padding: 20, paddingBottom: 8 },
  list: { padding: 16, gap: 10, paddingBottom: 40 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.5, paddingVertical: 8 },
  sessionCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sessionLeft: { flex: 1, gap: 4, marginRight: 12 },
  sessionTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  sessionDate: { fontSize: 12, color: colors.textMuted },
  knownRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  knownBadge: { paddingHorizontal: 8, paddingVertical: 3, backgroundColor: '#4ade8022', borderRadius: 6 },
  knownText: { fontSize: 12, color: '#4ade80', fontWeight: '600' },
  unknownBadge: { paddingHorizontal: 8, paddingVertical: 3, backgroundColor: colors.danger + '22', borderRadius: 6 },
  unknownText: { fontSize: 12, color: colors.danger, fontWeight: '600' },
  sessionPct: { fontSize: 22, fontWeight: '800', color: colors.coral },
  scorePctGood: { color: '#4ade80' },
  scorePctBad: { color: colors.danger },
  emptyState: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 8 },
  emptyText: { textAlign: 'center', color: colors.textMuted, fontSize: 14, lineHeight: 20 },
})
