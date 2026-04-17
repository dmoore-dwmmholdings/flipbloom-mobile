import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getDocs, query, where, collection, doc, getDoc, db } from '../lib/firebase'
import { colors } from '../lib/colors'
import type { Deck, FlashCard, StudySession, SavedQuiz } from '../lib/types'
import type { RootStackParamList } from '../navigation/types'

type Nav = NativeStackNavigationProp<RootStackParamList>
type Route = RouteProp<RootStackParamList, 'Deck'>

export default function DeckScreen() {
  const navigation = useNavigation<Nav>()
  const route = useRoute<Route>()
  const { deckId } = route.params

  const [deck, setDeck] = useState<Deck | null>(null)
  const [cards, setCards] = useState<FlashCard[]>([])
  const [sessions, setSessions] = useState<StudySession[]>([])
  const [quizzes, setQuizzes] = useState<SavedQuiz[]>([])
  const [activeTab, setActiveTab] = useState<'cards' | 'quizzes' | 'progress'>('cards')
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [deckDoc, cardSnap, sessionSnap, quizSnap] = await Promise.all([
        getDoc(doc(db, 'decks', deckId)),
        getDocs(query(collection(db, 'cards'), where('deckId', '==', deckId))),
        getDocs(query(collection(db, 'studySessions'), where('deckId', '==', deckId))),
        getDocs(query(collection(db, 'quizzes'), where('deckId', '==', deckId))),
      ])
      if (deckDoc.exists()) {
        setDeck({ id: deckDoc.id, ...deckDoc.data() } as Deck)
      }
      const cardList = cardSnap.docs
        .map((d) => ({ id: d.id, ...d.data() } as FlashCard))
        .sort((a, b) => a.order - b.order)
      setCards(cardList)
      setSessions(sessionSnap.docs.map((d) => ({ id: d.id, ...d.data() } as StudySession)))
      setQuizzes(quizSnap.docs.map((d) => ({ id: d.id, ...d.data() } as SavedQuiz)))
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [deckId])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  useEffect(() => {
    if (deck) {
      navigation.setOptions({ title: deck.title })
    }
  }, [deck, navigation])

  // Compute per-card mastery from all sessions
  const masteryMap: Record<string, { known: number; total: number }> = {}
  sessions.forEach((s) => {
    s.cardResults?.forEach((r) => {
      if (!masteryMap[r.cardId]) masteryMap[r.cardId] = { known: 0, total: 0 }
      masteryMap[r.cardId].total++
      if (r.known) masteryMap[r.cardId].known++
    })
  })

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator style={{ marginTop: 60 }} color={colors.coral} size="large" />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.deckMeta}>
        <Text style={styles.deckTitle}>{deck?.title}</Text>
        <Text style={styles.deckSub}>{deck?.cardCount} cards</Text>
        <View style={styles.studyActions}>
          <TouchableOpacity
            style={styles.studyBtn}
            onPress={() => deck && navigation.navigate('Study', { deckId, deckTitle: deck.title })}
          >
            <Text style={styles.studyBtnText}>Study</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quizBtn}
            onPress={() => deck && navigation.navigate('QuizSetup', { deckId, deckTitle: deck.title })}
          >
            <Text style={styles.quizBtnText}>Quiz</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.tabBar}>
        {(['cards', 'quizzes', 'progress'] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tabItem, activeTab === t && styles.tabItemActive]}
            onPress={() => setActiveTab(t)}
          >
            <Text style={[styles.tabItemText, activeTab === t && styles.tabItemTextActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'cards' && (
        <FlatList
          data={cards}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const mastery = masteryMap[item.id]
            const pct = mastery ? Math.round((mastery.known / mastery.total) * 100) : null
            return (
              <View style={styles.cardItem}>
                <View style={styles.cardContent}>
                  <Text style={styles.cardFront}>{item.front}</Text>
                  <Text style={styles.cardBack}>{item.back}</Text>
                </View>
                {pct !== null ? (
                  <View style={[styles.masteryBadge, { backgroundColor: pct >= 70 ? '#4ade8022' : colors.danger + '22' }]}>
                    <Text style={[styles.masteryText, { color: pct >= 70 ? '#4ade80' : colors.danger }]}>{pct}%</Text>
                  </View>
                ) : null}
              </View>
            )
          }}
          ListEmptyComponent={<Text style={styles.emptyText}>No cards in this deck.</Text>}
        />
      )}

      {activeTab === 'quizzes' && (
        <FlatList
          data={quizzes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.quizItem}>
              <View style={styles.quizInfo}>
                <Text style={styles.quizTitle}>{item.title}</Text>
                <Text style={styles.quizMeta}>{item.questions.length} questions</Text>
                {item.bestScore != null ? (
                  <Text style={styles.quizScore}>Best: {item.bestScore}%</Text>
                ) : null}
              </View>
              <TouchableOpacity
                style={styles.retakeBtn}
                onPress={() => navigation.navigate('QuizSetup', { deckId, deckTitle: deck?.title })}
              >
                <Text style={styles.retakeBtnText}>Retake</Text>
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>No quizzes yet.</Text>}
        />
      )}

      {activeTab === 'progress' && (
        <FlatList
          data={sessions}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const date = item.createdAt
              ? new Date(((item.createdAt as { seconds?: number }).seconds ?? 0) * 1000).toLocaleDateString()
              : '—'
            return (
              <TouchableOpacity
                style={styles.sessionItem}
                onPress={() => navigation.navigate('StudySessionDetail', { sessionId: item.id })}
              >
                <View>
                  <Text style={styles.sessionDate}>{date}</Text>
                  <Text style={styles.sessionStats}>
                    Known: {item.knownCount} / {item.totalCards}
                  </Text>
                </View>
                <Text style={styles.sessionPct}>
                  {Math.round((item.knownCount / item.totalCards) * 100)}%
                </Text>
              </TouchableOpacity>
            )
          }}
          ListEmptyComponent={<Text style={styles.emptyText}>No study sessions yet.</Text>}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  deckMeta: { padding: 20, gap: 4, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  deckTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
  deckSub: { fontSize: 14, color: colors.textMuted },
  studyActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  studyBtn: {
    flex: 1,
    height: 40,
    backgroundColor: colors.coral,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  studyBtnText: { fontSize: 14, fontWeight: '700', color: colors.text },
  quizBtn: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  quizBtnText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tabItem: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabItemActive: { borderBottomWidth: 2, borderBottomColor: colors.coral },
  tabItemText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  tabItemTextActive: { color: colors.coral },
  list: { padding: 16, gap: 10, paddingBottom: 40 },
  cardItem: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardContent: { flex: 1, gap: 4 },
  cardFront: { fontSize: 15, fontWeight: '600', color: colors.text },
  cardBack: { fontSize: 14, color: colors.textMuted },
  masteryBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  masteryText: { fontSize: 13, fontWeight: '700' },
  quizItem: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  quizInfo: { flex: 1, gap: 4 },
  quizTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  quizMeta: { fontSize: 13, color: colors.textMuted },
  quizScore: { fontSize: 13, color: colors.coral, fontWeight: '600' },
  retakeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.coral + '22',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.coral,
  },
  retakeBtnText: { fontSize: 13, color: colors.coral, fontWeight: '600' },
  sessionItem: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sessionDate: { fontSize: 14, fontWeight: '600', color: colors.text },
  sessionStats: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  sessionPct: { fontSize: 20, fontWeight: '800', color: colors.coral },
  emptyText: { textAlign: 'center', color: colors.textMuted, marginTop: 40 },
})
