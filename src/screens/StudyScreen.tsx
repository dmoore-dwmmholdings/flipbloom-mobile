import React, { useState, useCallback, useRef } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getDocs, query, where, collection, db } from '../lib/firebase'
import { saveStudySession } from '../lib/api'
import { colors } from '../lib/colors'
import type { FlashCard } from '../lib/types'
import type { RootStackParamList } from '../navigation/types'
import FlipCard from '../components/FlipCard'

type Nav = NativeStackNavigationProp<RootStackParamList>
type Route = RouteProp<RootStackParamList, 'Study'>

interface CardResult {
  cardId: string
  front: string
  back: string
  known: boolean
}

export default function StudyScreen() {
  const navigation = useNavigation<Nav>()
  const route = useRoute<Route>()
  const { deckId, deckTitle } = route.params

  const [cards, setCards] = useState<FlashCard[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [results, setResults] = useState<CardResult[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isFlipped, setIsFlipped] = useState(false)
  const startTimeRef = useRef(Date.now())

  useFocusEffect(
    useCallback(() => {
      const fetchCards = async () => {
        setLoading(true)
        try {
          const snap = await getDocs(query(collection(db, 'cards'), where('deckId', '==', deckId)))
          const list = snap.docs
            .map((d) => ({ id: d.id, ...d.data() } as FlashCard))
            .sort((a, b) => a.order - b.order)
          setCards(list)
          startTimeRef.current = Date.now()
        } catch (e) {
          console.error(e)
        } finally {
          setLoading(false)
        }
      }
      void fetchCards()
    }, [deckId])
  )

  const handleAnswer = async (known: boolean) => {
    const card = cards[currentIndex]
    const newResult: CardResult = {
      cardId: card.id,
      front: card.front,
      back: card.back,
      known,
    }
    const newResults = [...results, newResult]

    if (currentIndex < cards.length - 1) {
      setResults(newResults)
      setCurrentIndex(currentIndex + 1)
      setIsFlipped(false)
    } else {
      // Session complete
      setSaving(true)
      const knownCount = newResults.filter((r) => r.known).length
      const unknownCount = newResults.filter((r) => !r.known).length
      try {
        const duration = Math.round((Date.now() - startTimeRef.current) / 1000)
        await saveStudySession({
          deckId,
          deckTitle,
          knownCount,
          unknownCount,
          totalCards: cards.length,
          duration,
          cardResults: newResults,
        })
      } catch (e) {
        console.error('Failed to save session', e)
      }
      setSaving(false)
      navigation.replace('StudyComplete', {
        deckId,
        deckTitle,
        knownCount,
        unknownCount,
        totalCards: cards.length,
      })
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator style={{ marginTop: 60 }} color={colors.coral} size="large" />
      </SafeAreaView>
    )
  }

  if (cards.length === 0) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No cards in this deck</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  const progress = currentIndex / cards.length

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {saving && (
        <View style={styles.savingOverlay}>
          <ActivityIndicator color={colors.coral} />
          <Text style={styles.savingText}>Saving session...</Text>
        </View>
      )}

      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      <View style={styles.counter}>
        <Text style={styles.counterText}>{currentIndex + 1} / {cards.length}</Text>
      </View>

      <View style={styles.cardContainer}>
        <FlipCard
          key={`card-${currentIndex}`}
          front={cards[currentIndex].front}
          back={cards[currentIndex].back}
          onFlip={setIsFlipped}
        />
      </View>

      {isFlipped && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.unknownBtn}
            onPress={() => void handleAnswer(false)}
          >
            <Text style={styles.unknownBtnText}>Still Learning</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.knownBtn}
            onPress={() => void handleAnswer(true)}
          >
            <Text style={styles.knownBtnText}>Got It</Text>
          </TouchableOpacity>
        </View>
      )}

      {!isFlipped && (
        <View style={styles.hintContainer}>
          <Text style={styles.hintText}>Tap card to reveal answer</Text>
        </View>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  progressBar: {
    height: 3,
    backgroundColor: colors.surface,
    marginHorizontal: 20,
    borderRadius: 2,
    marginTop: 8,
  },
  progressFill: { height: '100%', backgroundColor: colors.coral, borderRadius: 2 },
  counter: { alignItems: 'center', paddingVertical: 12 },
  counterText: { fontSize: 14, color: colors.textMuted, fontWeight: '600' },
  cardContainer: { flex: 1, paddingHorizontal: 20, justifyContent: 'center' },
  actions: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    paddingBottom: 32,
  },
  unknownBtn: {
    flex: 1,
    height: 52,
    backgroundColor: colors.danger + '22',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.danger,
  },
  unknownBtnText: { fontSize: 16, fontWeight: '700', color: colors.danger },
  knownBtn: {
    flex: 1,
    height: 52,
    backgroundColor: '#4ade8022',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#4ade80',
  },
  knownBtnText: { fontSize: 16, fontWeight: '700', color: '#4ade80' },
  hintContainer: { padding: 20, alignItems: 'center', paddingBottom: 32 },
  hintText: { fontSize: 14, color: colors.textMuted },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  emptyTitle: { fontSize: 18, color: colors.textMuted },
  backBtn: { paddingHorizontal: 24, paddingVertical: 12, backgroundColor: colors.coral, borderRadius: 10 },
  backBtnText: { fontSize: 15, fontWeight: '700', color: colors.text },
  savingOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  savingText: { color: colors.text, fontSize: 15 },
})
