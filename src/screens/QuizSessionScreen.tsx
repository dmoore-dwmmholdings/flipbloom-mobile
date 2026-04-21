import React, { useState, useEffect, useRef, useCallback } from 'react'
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
import { saveQuizSession, judgeAnswer, streamQuiz } from '../lib/api'
import { colors } from '../lib/colors'
import type { QuizAnswer, QuizQuestion } from '../lib/types'
import type { RootStackParamList } from '../navigation/types'

type Nav = NativeStackNavigationProp<RootStackParamList>
type Route = RouteProp<RootStackParamList, 'QuizSession'>

export default function QuizSessionScreen() {
  const navigation = useNavigation<Nav>()
  const route = useRoute<Route>()
  const { questions: initialQuestions, quizId, quizTitle, streamingParams } = route.params

  // Streaming state
  const [streamQuestions, setStreamQuestions] = useState<QuizQuestion[]>(initialQuestions ?? [])
  const [streamStatus, setStreamStatus] = useState<'loading' | 'active' | 'done' | 'error'>(
    initialQuestions && initialQuestions.length > 0 ? 'done' : streamingParams ? 'loading' : 'done'
  )
  const [streamStep, setStreamStep] = useState('Preparing…')

  // Quiz state
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<QuizAnswer[]>([])
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [freeFormText, setFreeFormText] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [judging, setJudging] = useState(false)

  // Guard against double-save
  const savedRef = useRef(false)
  // Keep latest answers in ref for effects
  const answersRef = useRef<QuizAnswer[]>([])
  useEffect(() => { answersRef.current = answers }, [answers])

  // Start streaming if streamingParams provided
  useEffect(() => {
    if (!streamingParams) return
    let cancelled = false

    streamQuiz(
      streamingParams,
      (q) => {
        if (cancelled) return
        setStreamQuestions((prev) => {
          const next = [...prev, q]
          if (next.length === 1) setStreamStatus('active')
          return next
        })
      },
      (stepText) => {
        if (cancelled) return
        setStreamStep(stepText)
      }
    )
      .then(() => {
        if (!cancelled) setStreamStatus('done')
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setStreamStatus('error')
          setStreamStep((err as { message?: string }).message || 'Generation failed')
        }
      })

    return () => { cancelled = true }
  }, [])

  const saveAndNavigate = useCallback(async (finalAnswers: QuizAnswer[]) => {
    if (savedRef.current) return
    savedRef.current = true
    setSaving(true)
    try {
      const score = finalAnswers.filter((a) => a.correct).length
      const result = await saveQuizSession({
        quizId: quizId ?? 'adhoc',
        quizTitle,
        score,
        totalQuestions: finalAnswers.length,
        answers: finalAnswers,
      })
      navigation.replace('QuizResults', {
        sessionId: result.id,
        quizId: quizId ?? 'adhoc',
        quizTitle,
        score,
        total: finalAnswers.length,
        answers: finalAnswers,
      })
    } catch (e) {
      console.error(e)
      const score = finalAnswers.filter((a) => a.correct).length
      navigation.replace('QuizResults', {
        sessionId: 'local',
        quizId: quizId ?? 'adhoc',
        quizTitle,
        score,
        total: finalAnswers.length,
        answers: finalAnswers,
      })
    } finally {
      setSaving(false)
    }
  }, [navigation, quizId, quizTitle])

  // When streaming finishes, check if user already answered all questions
  useEffect(() => {
    if (streamStatus !== 'done') return
    if (streamQuestions.length === 0) return
    if (answersRef.current.length >= streamQuestions.length) {
      void saveAndNavigate(answersRef.current)
    }
  }, [streamStatus, streamQuestions.length, saveAndNavigate])

  // Loading skeleton while streaming hasn't delivered first question yet
  if (streamStatus === 'loading') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, padding: 24 }}>
          <ActivityIndicator color={colors.coral} size="large" />
          <Text style={{ color: colors.textMuted, fontSize: 15 }}>{streamStep}</Text>
          <View style={{ width: '100%', backgroundColor: colors.surface, borderRadius: 12, padding: 20, gap: 12 }}>
            <View style={{ height: 16, backgroundColor: colors.border, borderRadius: 6, width: '85%' }} />
            <View style={{ height: 16, backgroundColor: colors.border, borderRadius: 6, width: '65%' }} />
          </View>
          {[0, 1, 2, 3].map((i) => (
            <View
              key={i}
              style={{ width: '100%', height: 52, backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, borderColor: colors.border }}
            />
          ))}
        </View>
      </SafeAreaView>
    )
  }

  // Error state
  if (streamStatus === 'error') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 24 }}>
          <Text style={{ color: '#f87171', fontSize: 18, fontWeight: '700' }}>Quiz generation failed</Text>
          <Text style={{ color: colors.textMuted, textAlign: 'center' }}>{streamStep}</Text>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{ marginTop: 12, padding: 14, backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, borderColor: colors.border }}
          >
            <Text style={{ color: colors.coral, fontWeight: '600' }}>Back to Quiz Setup</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  // Waiting for next streamed question
  if (currentIndex >= streamQuestions.length && streamStatus !== 'done') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 }}>
          <ActivityIndicator color={colors.coral} />
          <Text style={{ color: colors.textMuted }}>Loading next question…</Text>
        </View>
      </SafeAreaView>
    )
  }

  const question = streamQuestions[currentIndex]
  // Shouldn't happen, but guard for safety
  if (!question) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color={colors.coral} />
        </View>
      </SafeAreaView>
    )
  }

  const totalCount = streamStatus === 'done' ? streamQuestions.length : undefined
  const progress = totalCount ? currentIndex / totalCount : 0

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

    const isLastQuestion = currentIndex === streamQuestions.length - 1
    if (isLastQuestion && streamStatus === 'done') {
      void saveAndNavigate(newAnswers)
    }
  }

  const handleNext = () => {
    setCurrentIndex((i) => i + 1)
    setSelectedOption(null)
    setFreeFormText('')
    setSubmitted(false)
  }

  const currentAnswer = answers[currentIndex]
  const isLastSubmitted = currentIndex === streamQuestions.length - 1 && submitted
  const moreQuestionsComingAfterLast = isLastSubmitted && streamStatus !== 'done'

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
          <Text style={styles.counter}>
            {currentIndex + 1} / {totalCount ?? '?'}
          </Text>
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

          {/* Show "Next Question" only if there are more questions (or more might stream in) */}
          {submitted && !moreQuestionsComingAfterLast && currentIndex < streamQuestions.length - 1 && (
            <TouchableOpacity style={styles.nextBtn} onPress={handleNext}>
              <Text style={styles.nextBtnText}>Next Question</Text>
            </TouchableOpacity>
          )}

          {/* Waiting for next question via stream */}
          {moreQuestionsComingAfterLast && (
            <View style={styles.waitingRow}>
              <ActivityIndicator size="small" color={colors.coral} />
              <Text style={styles.waitingText}>Loading next question…</Text>
            </View>
          )}

          {submitted && currentIndex === streamQuestions.length - 1 && streamStatus === 'done' && saving && (
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
  waitingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
  },
  waitingText: { fontSize: 14, color: colors.textMuted },
  savingText: { textAlign: 'center', color: colors.textMuted, fontSize: 14 },
})
