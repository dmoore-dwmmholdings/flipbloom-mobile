import React, { useState, useRef, useCallback } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { RootStackParamList } from '../navigation/types'
import { colors } from '../lib/colors'

type Nav = NativeStackNavigationProp<RootStackParamList>
type Route = RouteProp<RootStackParamList, 'BasicQuiz'>

interface CardResult {
  front: string
  back: string
  userAnswer: string
  correct: boolean
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

export default function BasicQuizScreen() {
  const navigation = useNavigation<Nav>()
  const route = useRoute<Route>()
  const { cards, deckTitle, deckId } = route.params

  const [index, setIndex] = useState(0)
  const [answer, setAnswer] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [correct, setCorrect] = useState(false)
  const [results, setResults] = useState<CardResult[]>([])
  const inputRef = useRef<TextInput>(null)

  const card = cards[index]
  const total = cards.length
  const isLast = index === total - 1

  const handleCheck = useCallback(() => {
    if (!answer.trim() || submitted) return
    const isCorrect = normalize(answer) === normalize(card.back)
    setCorrect(isCorrect)
    setSubmitted(true)
  }, [answer, submitted, card])

  const handleNext = useCallback(() => {
    const newResult: CardResult = {
      front: card.front,
      back: card.back,
      userAnswer: answer.trim(),
      correct,
    }
    const updatedResults = [...results, newResult]

    if (isLast) {
      const score = updatedResults.filter((r) => r.correct).length
      navigation.navigate('BasicQuizResults', {
        results: updatedResults,
        deckTitle,
        deckId,
        score,
        total,
      })
    } else {
      setResults(updatedResults)
      setIndex((i) => i + 1)
      setAnswer('')
      setSubmitted(false)
      setCorrect(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [card, answer, correct, results, isLast, navigation, deckTitle, deckId, total])

  const progressPct = ((index) / total) * 100

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle} numberOfLines={1}>{deckTitle}</Text>
          <Text style={styles.counter}>{index + 1} / {total}</Text>
        </View>

        {/* Progress bar */}
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Card front */}
          <View style={styles.cardView}>
            <Text style={styles.cardLabel}>QUESTION</Text>
            <Text style={styles.cardFront}>{card.front}</Text>
          </View>

          {/* Answer input */}
          <TextInput
            ref={inputRef}
            style={styles.answerInput}
            placeholder="Type your answer…"
            placeholderTextColor={colors.textMuted}
            value={answer}
            onChangeText={setAnswer}
            autoFocus
            editable={!submitted}
            returnKeyType="done"
            onSubmitEditing={handleCheck}
          />

          {/* Feedback banner */}
          {submitted && (
            <View style={[styles.banner, correct ? styles.bannerCorrect : styles.bannerWrong]}>
              {correct ? (
                <Text style={styles.bannerText}>✓ Correct!</Text>
              ) : (
                <View>
                  <Text style={styles.bannerText}>✗ Not quite</Text>
                  <Text style={styles.bannerAnswer}>Answer: {card.back}</Text>
                </View>
              )}
            </View>
          )}

          {!submitted ? (
            <TouchableOpacity
              style={[styles.actionBtn, !answer.trim() && styles.actionBtnDisabled]}
              onPress={handleCheck}
              disabled={!answer.trim()}
            >
              <Text style={styles.actionBtnText}>Check Answer</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.actionBtn} onPress={handleNext}>
              <Text style={styles.actionBtnText}>{isLast ? 'See Results' : 'Next →'}</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.text, flex: 1, marginRight: 12 },
  counter: { fontSize: 14, color: colors.textMuted, fontWeight: '600' },
  progressTrack: {
    height: 4,
    backgroundColor: colors.surface,
    borderRadius: 2,
    overflow: 'hidden',
    marginHorizontal: 20,
    marginBottom: 8,
  },
  progressFill: {
    height: 4,
    backgroundColor: colors.coral,
    borderRadius: 2,
  },
  scroll: { padding: 20, gap: 16, paddingBottom: 40 },
  cardView: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
    minHeight: 140,
    justifyContent: 'center',
  },
  cardLabel: { fontSize: 11, fontWeight: '700', color: colors.textMuted, letterSpacing: 1 },
  cardFront: { fontSize: 20, fontWeight: '700', color: colors.text, lineHeight: 28 },
  answerInput: {
    height: 52,
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 16,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  banner: {
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
  },
  bannerCorrect: { backgroundColor: '#14532d22', borderColor: '#4ade80' },
  bannerWrong: { backgroundColor: '#7f1d1d22', borderColor: '#f87171' },
  bannerText: { fontSize: 15, fontWeight: '700', color: colors.text },
  bannerAnswer: { fontSize: 14, color: '#4ade80', marginTop: 4 },
  actionBtn: {
    height: 52,
    backgroundColor: colors.coral,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  actionBtnDisabled: { opacity: 0.4 },
  actionBtnText: { fontSize: 16, fontWeight: '700', color: colors.text },
})
