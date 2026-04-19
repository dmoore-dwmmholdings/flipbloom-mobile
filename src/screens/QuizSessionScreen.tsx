import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { saveQuizSession, judgeAnswer } from '../lib/api'
import { colors } from '../lib/colors'
import type { QuizAnswer } from '../lib/types'
import type { RootStackParamList } from '../navigation/types'

type Nav = NativeStackNavigationProp<RootStackParamList>
type Route = RouteProp<RootStackParamList, 'QuizSession'>

export default function QuizSessionScreen() {
  const navigation = useNavigation<Nav>()
  const route = useRoute<Route>()
  const { questions, quizId, quizTitle } = route.params

  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<QuizAnswer[]>([])
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [freeFormText, setFreeFormText] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [judging, setJudging] = useState(false)

  const question = questions[currentIndex]
  const progress = currentIndex / questions.length

  const handleSelectOption = (option: string) => {
    if (submitted) return
    setSelectedOption(option)
  }

  const handleSubmitAnswer = async (answer: string) => {
    if (submitted) return

    let isCorrect: boolean
    let feedback: string | null = null

    if (question.type === 'multiple_choice') {
      isCorrect = answer.trim().toLowerCase() === question.correct.toLowerCase()
    } else {
      // Short answer — use judgeAnswer API
      setJudging(true)
      try {
        const result = await judgeAnswer({
          question: question.question,
          correctAnswer: question.correct,
          userAnswer: answer,
        })
        isCorrect = result.result
        feedback = result.feedback
      } catch {
        // Fall back to string comparison on error
        isCorrect = answer.trim().toLowerCase() === question.correct.toLowerCase()
      } finally {
        setJudging(false)
      }
    }

    const newAnswer: QuizAnswer = {
      questionId: question.id,
      userAnswer: answer,
      correct: isCorrect,
      feedback,
    }
    const newAnswers = [...answers, newAnswer]
    setAnswers(newAnswers)
    setSubmitted(true)

    if (currentIndex === questions.length - 1) {
      // Last question — save and navigate
      setSaving(true)
      try {
        const score = newAnswers.filter((a) => a.correct).length
        const result = await saveQuizSession({
          quizId: quizId ?? 'adhoc',
          quizTitle,
          score,
          totalQuestions: questions.length,
          answers: newAnswers,
        })
        navigation.replace('QuizResults', {
          sessionId: result.id,
          quizId: quizId ?? 'adhoc',
          quizTitle,
          score,
          total: questions.length,
          answers: newAnswers,
        })
      } catch (e) {
        console.error(e)
        // Navigate even if save fails
        const score = newAnswers.filter((a) => a.correct).length
        navigation.replace('QuizResults', {
          sessionId: 'local',
          quizId: quizId ?? 'adhoc',
          quizTitle,
          score,
          total: questions.length,
          answers: newAnswers,
        })
      } finally {
        setSaving(false)
      }
    }
  }

  const handleNext = () => {
    setCurrentIndex(currentIndex + 1)
    setSelectedOption(null)
    setFreeFormText('')
    setSubmitted(false)
  }

  const currentAnswer = answers[currentIndex]

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.counter}>{currentIndex + 1} / {questions.length}</Text>
          <Text style={styles.questionType}>{question.type.replace('_', ' ').toUpperCase()}</Text>
          <Text style={styles.questionText}>{question.question}</Text>

          {question.type === 'multiple_choice' && question.options && (
            <View style={styles.optionsList}>
              {question.options.map((opt, idx) => {
                let optStyle = styles.option
                let textStyle = styles.optionText
                if (submitted) {
                  if (opt === question.correct) {
                    optStyle = { ...styles.option, ...styles.optionCorrect }
                  } else if (opt === selectedOption && opt !== question.correct) {
                    optStyle = { ...styles.option, ...styles.optionWrong }
                  }
                } else if (opt === selectedOption) {
                  optStyle = { ...styles.option, ...styles.optionSelected }
                  textStyle = { ...styles.optionText, ...styles.optionTextSelected }
                }
                return (
                  <TouchableOpacity
                    key={idx}
                    style={optStyle}
                    onPress={() => handleSelectOption(opt)}
                  >
                    <Text style={textStyle}>{opt}</Text>
                  </TouchableOpacity>
                )
              })}
              {!submitted && selectedOption && (
                <TouchableOpacity style={styles.submitBtn} onPress={() => void handleSubmitAnswer(selectedOption)}>
                  <Text style={styles.submitBtnText}>Submit</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {question.type === 'true_false' && (
            <View style={styles.tfButtons}>
              {['True', 'False'].map((opt) => {
                let btnStyle = styles.tfBtn
                if (submitted) {
                  if (opt.toLowerCase() === question.correct.toLowerCase()) {
                    btnStyle = { ...styles.tfBtn, ...styles.optionCorrect }
                  } else if (opt === selectedOption) {
                    btnStyle = { ...styles.tfBtn, ...styles.optionWrong }
                  }
                } else if (opt === selectedOption) {
                  btnStyle = { ...styles.tfBtn, ...styles.optionSelected }
                }
                return (
                  <TouchableOpacity
                    key={opt}
                    style={btnStyle}
                    onPress={() => {
                      handleSelectOption(opt)
                      if (!submitted) void handleSubmitAnswer(opt)
                    }}
                  >
                    <Text style={styles.tfBtnText}>{opt}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          )}

          {question.type === 'free_form' && (
            <View style={styles.freeFormArea}>
              <TextInput
                style={styles.freeFormInput}
                placeholder="Type your answer..."
                placeholderTextColor={colors.textMuted}
                value={freeFormText}
                onChangeText={setFreeFormText}
                multiline
                textAlignVertical="top"
                editable={!submitted}
              />
              {!submitted && (
                <TouchableOpacity
                  style={[styles.submitBtn, !freeFormText.trim() && styles.btnDisabled]}
                  onPress={() => void handleSubmitAnswer(freeFormText)}
                  disabled={!freeFormText.trim()}
                >
                  <Text style={styles.submitBtnText}>Submit</Text>
                </TouchableOpacity>
              )}
              {submitted && (
                <View style={styles.freeFormResult}>
                  <Text style={styles.correctLabel}>Correct answer:</Text>
                  <Text style={styles.correctAnswer}>{question.correct}</Text>
                  <View style={[styles.judgeBadge, currentAnswer?.correct ? styles.judgeBadgeGreen : styles.judgeBadgeRed]}>
                    <Text style={styles.judgeBadgeText}>
                      {currentAnswer?.correct ? 'Correct' : 'Incorrect'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      const updated = [...answers]
                      updated[currentIndex] = { ...updated[currentIndex], correct: !currentAnswer?.correct, overridden: true }
                      setAnswers(updated)
                    }}
                    style={styles.overrideBtn}
                  >
                    <Text style={styles.overrideBtnText}>Override judgment</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {judging && (
            <View style={styles.judgingIndicator}>
              <ActivityIndicator size="small" color={colors.coral} />
              <Text style={styles.judgingText}>Checking your answer…</Text>
            </View>
          )}

          {submitted && question.explanation ? (
            <View style={styles.explanation}>
              <Text style={styles.explanationLabel}>Explanation</Text>
              <Text style={styles.explanationText}>{question.explanation}</Text>
            </View>
          ) : null}

          {submitted && currentIndex < questions.length - 1 && (
            <TouchableOpacity style={styles.nextBtn} onPress={handleNext}>
              <Text style={styles.nextBtnText}>Next Question</Text>
            </TouchableOpacity>
          )}

          {submitted && currentIndex === questions.length - 1 && saving && (
            <Text style={styles.savingText}>Saving results...</Text>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  progressBar: { height: 3, backgroundColor: colors.surface, marginHorizontal: 20, borderRadius: 2, marginTop: 4 },
  progressFill: { height: '100%', backgroundColor: colors.coral, borderRadius: 2 },
  scroll: { padding: 20, gap: 16, paddingBottom: 40 },
  counter: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  questionType: { fontSize: 11, color: colors.coral, fontWeight: '700', letterSpacing: 1 },
  questionText: { fontSize: 18, fontWeight: '700', color: colors.text, lineHeight: 26 },
  optionsList: { gap: 10 },
  option: {
    padding: 14,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionSelected: { borderColor: colors.coral, backgroundColor: colors.coral + '22' },
  optionCorrect: { borderColor: '#4ade80', backgroundColor: '#4ade8022' },
  optionWrong: { borderColor: colors.danger, backgroundColor: colors.danger + '22' },
  optionText: { fontSize: 15, color: colors.text },
  optionTextSelected: { color: colors.coral, fontWeight: '600' },
  tfButtons: { flexDirection: 'row', gap: 12 },
  tfBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  tfBtnText: { fontSize: 17, fontWeight: '700', color: colors.text },
  freeFormArea: { gap: 12 },
  freeFormInput: {
    height: 120,
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  freeFormResult: { gap: 8 },
  correctLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  correctAnswer: { fontSize: 15, color: colors.text, fontWeight: '600' },
  judgingIndicator: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  judgingText: { fontSize: 13, color: colors.textMuted },
  judgeBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, alignSelf: 'flex-start' },
  judgeBadgeGreen: { backgroundColor: '#4ade8022' },
  judgeBadgeRed: { backgroundColor: colors.danger + '22' },
  judgeBadgeText: { fontSize: 13, fontWeight: '700', color: colors.text },
  overrideBtn: { paddingVertical: 8 },
  overrideBtnText: { fontSize: 13, color: colors.coral, fontWeight: '600' },
  explanation: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  explanationLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '700', letterSpacing: 0.5 },
  explanationText: { fontSize: 14, color: colors.text, lineHeight: 20 },
  submitBtn: {
    height: 48,
    backgroundColor: colors.coral,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.5 },
  submitBtnText: { fontSize: 15, fontWeight: '700', color: colors.text },
  nextBtn: {
    height: 52,
    backgroundColor: colors.coral,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextBtnText: { fontSize: 16, fontWeight: '700', color: colors.text },
  savingText: { textAlign: 'center', color: colors.textMuted, fontSize: 14 },
})
