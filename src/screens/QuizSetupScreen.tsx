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
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Check } from 'lucide-react-native'
import { generateQuiz } from '../lib/api'
import { colors } from '../lib/colors'
import type { RootStackParamList } from '../navigation/types'
import LoadingSpinner from '../components/LoadingSpinner'

type Nav = NativeStackNavigationProp<RootStackParamList>
type Route = RouteProp<RootStackParamList, 'QuizSetup'>

const QUESTION_TYPES = [
  { id: 'multiple_choice', label: 'Multiple Choice' },
  { id: 'true_false', label: 'True / False' },
  { id: 'free_form', label: 'Free Form' },
]

export default function QuizSetupScreen() {
  const navigation = useNavigation<Nav>()
  const route = useRoute<Route>()
  const { deckId, deckTitle } = route.params ?? {}

  const [count, setCount] = useState(10)
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['multiple_choice'])
  const [customText, setCustomText] = useState('')
  const [loading, setLoading] = useState(false)

  const toggleType = (typeId: string) => {
    setSelectedTypes((prev) =>
      prev.includes(typeId) ? prev.filter((t) => t !== typeId) : [...prev, typeId]
    )
  }

  const handleGenerate = async () => {
    if (selectedTypes.length === 0) {
      Alert.alert('Error', 'Select at least one question type.')
      return
    }
    if (!deckId && !customText.trim()) {
      Alert.alert('Error', 'Provide a deck or paste text content.')
      return
    }

    setLoading(true)
    try {
      const result = await generateQuiz({
        deckId,
        text: customText.trim() || undefined,
        count,
        types: selectedTypes,
      })
      navigation.navigate('QuizSession', {
        questions: result.questions,
        quizTitle: deckTitle ?? result.deckTitle ?? 'Quiz',
      })
    } catch (e) {
      const err = e as Error
      Alert.alert('Error', err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <LoadingSpinner fullScreen />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
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

          <TouchableOpacity style={styles.generateBtn} onPress={handleGenerate}>
            <Text style={styles.generateBtnText}>Generate Quiz</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 20, gap: 16, paddingBottom: 40 },
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
  generateBtnText: { fontSize: 16, fontWeight: '700', color: colors.text },
})
