import React from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { RootStackParamList } from '../navigation/types'
import { colors } from '../lib/colors'

type Nav = NativeStackNavigationProp<RootStackParamList>
type Route = RouteProp<RootStackParamList, 'BasicQuizResults'>

export default function BasicQuizResultsScreen() {
  const navigation = useNavigation<Nav>()
  const route = useRoute<Route>()
  const { results, deckTitle, deckId, score, total } = route.params

  const pct = total > 0 ? Math.round((score / total) * 100) : 0
  const missed = total - score

  const scoreColor =
    pct >= 80 ? '#4ade80' : pct >= 60 ? colors.amber : '#f87171'

  const missedResults = results.filter((r) => !r.correct)

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Score */}
        <View style={styles.scoreCard}>
          <Text style={[styles.scorePct, { color: scoreColor }]}>{pct}%</Text>
          <Text style={styles.scoreSummary}>
            {score} correct · {missed} missed · {total} total
          </Text>
          <Text style={styles.deckName}>{deckTitle}</Text>
        </View>

        {/* Actions */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => navigation.navigate('QuizSetup', { deckId: deckId ?? undefined, deckTitle })}
          >
            <Text style={styles.actionBtnText}>Retry</Text>
          </TouchableOpacity>
          {deckId ? (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnSecondary]}
              onPress={() => navigation.navigate('Deck', { deckId })}
            >
              <Text style={styles.actionBtnTextSecondary}>Review Deck</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Missed cards */}
        {missedResults.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Missed ({missedResults.length})</Text>
            {missedResults.map((r, i) => (
              <View key={i} style={styles.missedCard}>
                <Text style={styles.missedFront}>{r.front}</Text>
                <Text style={styles.missedUserAnswer}>Your answer: {r.userAnswer || '(blank)'}</Text>
                <Text style={styles.missedCorrectAnswer}>Answer: {r.back}</Text>
              </View>
            ))}
          </>
        )}

        {/* Full results list */}
        <Text style={styles.sectionTitle}>All Cards</Text>
        {results.map((r, i) => (
          <View key={i} style={[styles.resultRow, r.correct ? styles.resultRowCorrect : styles.resultRowWrong]}>
            <Text style={styles.resultIcon}>{r.correct ? '✓' : '✗'}</Text>
            <Text style={styles.resultFront} numberOfLines={2}>{r.front}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 20, gap: 16, paddingBottom: 48 },
  scoreCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  scorePct: { fontSize: 72, fontWeight: '800', lineHeight: 80 },
  scoreSummary: { fontSize: 15, color: colors.textMuted, fontWeight: '500' },
  deckName: { fontSize: 14, color: colors.textMuted, marginTop: 4 },
  actionRow: { flexDirection: 'row', gap: 12 },
  actionBtn: {
    flex: 1,
    height: 48,
    backgroundColor: colors.coral,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionBtnText: { fontSize: 15, fontWeight: '700', color: colors.text },
  actionBtnTextSecondary: { fontSize: 15, fontWeight: '600', color: colors.textMuted },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 8 },
  missedCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#f8717144',
    gap: 4,
  },
  missedFront: { fontSize: 15, fontWeight: '700', color: colors.text },
  missedUserAnswer: { fontSize: 13, color: '#f87171' },
  missedCorrectAnswer: { fontSize: 13, color: '#4ade80' },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  resultRowCorrect: {
    backgroundColor: '#14532d11',
    borderColor: '#4ade8033',
  },
  resultRowWrong: {
    backgroundColor: '#7f1d1d11',
    borderColor: '#f8717133',
  },
  resultIcon: { fontSize: 16, fontWeight: '700', width: 20, textAlign: 'center', color: colors.text },
  resultFront: { fontSize: 14, color: colors.text, flex: 1 },
})
