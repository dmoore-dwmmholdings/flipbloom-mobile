import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Check } from 'lucide-react-native'
import { getDocs, query, collection, db, where } from '../lib/firebase'
import { colors } from '../lib/colors'
import type { RootStackParamList } from '../navigation/types'
import type { Card } from '../lib/types'

type Nav = NativeStackNavigationProp<RootStackParamList>
type Route = RouteProp<RootStackParamList, 'QuizSetup'>

const QUESTION_TYPES = [
  { id: 'multiple_choice', label: 'Multiple Choice' },
  { id: 'true_false', label: 'True / False' },
  { id: 'free_form', label: 'Free Form' },
]

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function QuizSetupScreen() {
  const navigation = useNavigation<Nav>()
  const route = useRoute<Route>()
  const { deckId, deckTitle } = route.params ?? {}

  const [quizMode, setQuizMode] = useState<'basic' | 'smart'>('basic')
  const [count, setCount] = useState(10)
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['multiple_choice'])
  const [customText, setCustomText] = useState('')
  const [loading, setLoading] = useState(false)

  const toggleType = (typeId: string) => {
    setSelectedTypes((prev) =>
      prev.includes(typeId) ? prev.filter((t) => t !== typeId) : [...prev, typeId]
    )
  }

  const handleBasicQuiz = async () => {
    if (!deckId) {
      Alert.alert('Error', 'Basic Quiz requires a deck.')
      return
    }
    setLoading(true)
    try {
      const snap = await getDocs(query(collection(db, 'cards'), where('deckId', '==', deckId)))
      const cards: Card[] = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Card))
      const shuffled = shuffleArray(cards).slice(0, count)
      navigation.navigate('BasicQuiz', {
        cards: shuffled.map((c) => ({ id: c.id, front: c.front, back: c.back, order: c.order })),
        deckTitle: deckTitle ?? 'Quiz',
        deckId,
      })
    } catch (e) {
      Alert.alert('Error', 'Failed to load cards.')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleSmartTest = () => {
    if (selectedTypes.length === 0) {
      Alert.alert('Error', 'Select at least one question type.')
      return
    }
    if (!deckId && !customText.trim()) {
      Alert.alert('Error', 'Provide a deck or paste text content.')
      return
    }

    navigation.navigate('QuizSession', {
      quizTitle: deckTitle || 'Quiz',
      streamingParams: {
        deckId,
        text: customText.trim() || undefined,
        count,
        types: selectedTypes,
        deckTitle: deckTitle || 'Quiz',
      },
    })
  }

  const handleGenerate = () => {
    if (quizMode === 'basic') {
      void handleBasicQuiz()
    } else {
      handleSmartTest()
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Mode toggle */}
          <Text style={styles.sectionLabel}>Quiz Mode</Text>
          <View style={styles.modeToggleRow}>
            <TouchableOpacity
              style={[styles.modeBtn, quizMode === 'basic' && styles.modeBtnActive]}
              onPress={() => setQuizMode('basic')}
            >
              <Text style={[styles.modeBtnText, quizMode === 'basic' && styles.modeBtnTextActive]}>Basic Quiz</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeBtn, quizMode === 'smart' && styles.modeBtnActive]}
              onPress={() => setQuizMode('smart')}
            >
              <Text style={[styles.modeBtnText, quizMode === 'smart' && styles.modeBtnTextActive]}>Smart Test</Text>
            </TouchableOpacity>
          </View>
          {quizMode === 'basic' && (
            <Text style={styles.modeHelper}>Type the answer — checked case & punctuation insensitive</Text>
          )}
          {quizMode === 'smart' && (
            <Text style={styles.modeHelper}>AI generates questions from your deck content</Text>
          )}

          {deckTitle ? (
            <View style={styles.deckInfo}>
              <Text style={styles.deckLabel}>From deck:</Text>
              <Text style={styles.deckName}>{deckTitle}</Text>
            </View>
          ) : (
            <>
              <Text style={styles.sectionLabel}>Paste text content</Text>
              <TextInput
                style={styles.textarea}
                placeholder="Paste text to generate quiz from..."
                placeholderTextColor={colors.textMuted}
                value={customText}
                onChangeText={setCustomText}
                multiline
                textAlignVertical="top"
              />
            </>
          )}

          <Text style={styles.sectionLabel}>Question Count: {count}</Text>
          <View style={styles.countButtons}>
            {[5, 10, 15, 20].map((n) => (
              <TouchableOpacity
                key={n}
                style={[styles.countBtn, count === n && styles.countBtnActive]}
                onPress={() => setCount(n)}
              >
                <Text style={[styles.countBtnText, count === n && styles.countBtnTextActive]}>{n}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {quizMode === 'smart' && (
            <>
              <Text style={styles.sectionLabel}>Question Types</Text>
              <View style={styles.typeList}>
                {QUESTION_TYPES.map((t) => {
                  const isSelected = selectedTypes.includes(t.id)
                  return (
                    <TouchableOpacity
                      key={t.id}
                      style={[styles.typeItem, isSelected && styles.typeItemActive]}
                      onPress={() => toggleType(t.id)}
                    >
                      <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                        {isSelected ? <Check size={14} color={colors.text} /> : null}
                      </View>
                      <Text style={[styles.typeLabel, isSelected && styles.typeLabelActive]}>{t.label}</Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            </>
          )}

          <TouchableOpacity
            style={[styles.generateBtn, loading && styles.generateBtnDisabled]}
            onPress={handleGenerate}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <Text style={styles.generateBtnText}>
                {quizMode === 'basic' ? 'Start Basic Quiz' : 'Generate Smart Test'}
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 20, gap: 16, paddingBottom: 40 },
  modeToggleRow: { flexDirection: 'row', gap: 8 },
  modeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  modeBtnActive: { backgroundColor: colors.coral + '22', borderColor: colors.coral },
  modeBtnText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  modeBtnTextActive: { color: colors.coral },
  modeHelper: { fontSize: 12, color: colors.textMuted, fontStyle: 'italic' },
  deckInfo: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  deckLabel: { fontSize: 12, color: colors.textMuted },
  deckName: { fontSize: 17, fontWeight: '700', color: colors.text },
  sectionLabel: { fontSize: 15, fontWeight: '600', color: colors.text },
  textarea: {
    height: 140,
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  countButtons: { flexDirection: 'row', gap: 8 },
  countBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  countBtnActive: { backgroundColor: colors.coral + '22', borderColor: colors.coral },
  countBtnText: { fontSize: 15, color: colors.textMuted, fontWeight: '600' },
  countBtnTextActive: { color: colors.coral },
  typeList: { gap: 8 },
  typeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeItemActive: { borderColor: colors.coral, backgroundColor: colors.coral + '11' },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: { backgroundColor: colors.coral, borderColor: colors.coral },
  typeLabel: { fontSize: 15, color: colors.textMuted },
  typeLabelActive: { color: colors.text, fontWeight: '600' },
  generateBtn: {
    height: 52,
    backgroundColor: colors.coral,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  generateBtnDisabled: { opacity: 0.6 },
  generateBtnText: { fontSize: 16, fontWeight: '700', color: colors.text },
})
