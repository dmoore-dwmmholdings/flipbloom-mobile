import React, { useState } from 'react'
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
import { CheckCircle, XCircle } from 'lucide-react-native'
import { getProgressFeedback } from '../lib/api'
import { colors } from '../lib/colors'
import type { QuizAnswer } from '../lib/types'
import type { RootStackParamList } from '../navigation/types'

type Nav = NativeStackNavigationProp<RootStackParamList>
type Route = RouteProp<RootStackParamList, 'QuizResults'>

export default function QuizResultsScreen() {
  const navigation = useNavigation<Nav>()
  const route = useRoute<Route>()
  const { sessionId, quizId, quizTitle, score, total, answers } = route.params

  const [feedback, setFeedback] = useState<string | null>(null)
  const [loadingFeedback, setLoadingFeedback] = useState(false)

  const percentage = Math.round((score / total) * 100)

  const handleGetFeedback = async () => {
    setLoadingFeedback(true)
    try {
      const result = await getProgressFeedback({
        sessionId,
        answers,
        quizTitle,
      })
      setFeedback(result.feedback)
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingFeedback(false)
    }
  }

  const renderAnswer = ({ item }: { item: QuizAnswer }) => (
    <View style={[styles.answerItem, item.correct ? styles.answerCorrect : styles.answerWrong]}>
      <View style={styles.answerIcon}>
        {item.correct
          ? <CheckCircle size={20} color="#4ade80" />
          : <XCircle size={20} color={colors.danger} />
        }
      </View>
      <View style={styles.answerContent}>
        <Text style={styles.userAnswer}>Your answer: {item.userAnswer}</Text>
        {!item.correct && (
          <Text style={styles.correctAnswer}>Correct: {item.correct ? 'True' : '—'}</Text>
        )}
        {item.feedback ? <Text style={styles.aiFeedback}>{item.feedback}</Text> : null}
      </View>
    </View>
  )

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <FlatList
        data={answers}
        keyExtractor={(item, idx) => `${item.questionId}-${idx}`}
        contentContainerStyle={styles.scroll}
        ListHeaderComponent={
          <>
            <View style={styles.scoreCard}>
              <Text style={styles.scoreLabel}>Score</Text>
              <Text style={styles.scoreValue}>{score} / {total}</Text>
              <Text style={[styles.scorePct, percentage >= 70 ? styles.scorePctGood : styles.scorePctBad]}>
                {percentage}%
              </Text>
              <Text style={styles.quizTitleText}>{quizTitle}</Text>
            </View>

            {feedback ? (
              <View style={styles.feedbackCard}>
                <Text style={styles.feedbackLabel}>AI Feedback</Text>
                <Text style={styles.feedbackText}>{feedback}</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.feedbackBtn, loadingFeedback && styles.btnDisabled]}
                onPress={() => void handleGetFeedback()}
                disabled={loadingFeedback}
              >
                {loadingFeedback
                  ? <ActivityIndicator size="small" color={colors.text} />
                  : <Text style={styles.feedbackBtnText}>Get AI Feedback</Text>
                }
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.retakeBtn}
              onPress={() => navigation.navigate('QuizSetup', {})}
            >
              <Text style={styles.retakeBtnText}>New Quiz</Text>
            </TouchableOpacity>

            <Text style={styles.sectionTitle}>Question Breakdown</Text>
          </>
        }
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 20, gap: 14, paddingBottom: 40 },
  scoreCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  scoreLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '700', letterSpacing: 1 },
  scoreValue: { fontSize: 40, fontWeight: '800', color: colors.text },
  scorePct: { fontSize: 22, fontWeight: '700' },
  scorePctGood: { color: '#4ade80' },
  scorePctBad: { color: colors.danger },
  quizTitleText: { fontSize: 14, color: colors.textMuted, marginTop: 4 },
  feedbackCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.coral + '55',
    gap: 8,
  },
  feedbackLabel: { fontSize: 12, color: colors.coral, fontWeight: '700', letterSpacing: 0.5 },
  feedbackText: { fontSize: 14, color: colors.text, lineHeight: 22 },
  feedbackBtn: {
    height: 48,
    backgroundColor: colors.coral + '22',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.coral,
  },
  feedbackBtnText: { fontSize: 15, fontWeight: '700', color: colors.coral },
  btnDisabled: { opacity: 0.5 },
  retakeBtn: {
    height: 52,
    backgroundColor: colors.surface,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  retakeBtnText: { fontSize: 15, fontWeight: '600', color: colors.textMuted },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  answerItem: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: colors.surface,
  },
  answerCorrect: { borderColor: '#4ade8055' },
  answerWrong: { borderColor: colors.danger + '55' },
  answerIcon: { paddingTop: 2 },
  answerContent: { flex: 1, gap: 4 },
  userAnswer: { fontSize: 14, color: colors.text },
  correctAnswer: { fontSize: 13, color: '#4ade80' },
  aiFeedback: { fontSize: 13, color: colors.textMuted, fontStyle: 'italic' },
})
