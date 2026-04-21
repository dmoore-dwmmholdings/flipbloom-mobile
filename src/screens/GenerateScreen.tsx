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
  Switch,
  Modal,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { useFocusEffect } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import * as DocumentPicker from 'expo-document-picker'
import { File as FSFile } from 'expo-file-system/next'
import { File, FileText } from 'lucide-react-native'
import { addDoc, collection, db, serverTimestamp, getDocs, query, where, updateDoc, doc } from '../lib/firebase'
import { streamFlashcards, generateFromFile } from '../lib/api'
import { useAuth } from '../lib/AuthContext'
import { useGeneration } from '../lib/GenerationContext'
import { colors } from '../lib/colors'
import type { RootStackParamList } from '../navigation/types'

type Nav = NativeStackNavigationProp<RootStackParamList>

async function saveDeckToFirestore(
  currentUser: { uid: string } | null,
  cards: { front: string; back: string }[],
  deckTitle: string,
  topicName: string | null,
  existingTopicsList: string[]
): Promise<string> {
  if (!currentUser) throw new Error('No user')

  let topicId: string | null = null
  let topicNameFinal: string | null = null

  if (topicName) {
    const topicSnap = await getDocs(
      query(collection(db, 'topics'), where('uid', '==', currentUser.uid), where('name', '==', topicName))
    )
    if (!topicSnap.empty) {
      topicId = topicSnap.docs[0].id
      topicNameFinal = topicName
    } else {
      const topicColors = ['#ed674a', '#f49f48', '#4ade80', '#60a5fa', '#a78bfa', '#f472b6']
      const color = topicColors[existingTopicsList.length % topicColors.length]
      const newTopic = await addDoc(collection(db, 'topics'), {
        uid: currentUser.uid,
        name: topicName,
        color,
        createdAt: serverTimestamp(),
      })
      topicId = newTopic.id
      topicNameFinal = topicName
    }
  }

  const deckRef = await addDoc(collection(db, 'decks'), {
    uid: currentUser.uid,
    title: deckTitle,
    cardCount: cards.length,
    topicId,
    topicName: topicNameFinal,
    createdAt: serverTimestamp(),
  })

  await Promise.all(cards.map((card, idx) =>
    addDoc(collection(db, 'cards'), {
      uid: currentUser.uid,
      deckId: deckRef.id,
      front: card.front,
      back: card.back,
      order: idx,
    })
  ))

  return deckRef.id
}

export default function GenerateScreen() {
  const { user, profile } = useAuth()
  const navigation = useNavigation<Nav>()
  const { startGeneration, updateStep, updateCount, resolveGeneration, failGeneration, setRetryFn } = useGeneration()

  const [tab, setTab] = useState<'text' | 'file'>('text')
  const [text, setText] = useState('')
  const [autoCount, setAutoCount] = useState(true)
  const [count, setCount] = useState(20)
  const [manualCount, setManualCount] = useState('')
  const [title, setTitle] = useState('')
  const [answerMode, setAnswerMode] = useState<'brief' | 'detailed'>('brief')
  const [selectedFile, setSelectedFile] = useState<{ name: string; uri: string; mimeType: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [existingTitles, setExistingTitles] = useState<string[]>([])
  const [existingTopics, setExistingTopics] = useState<string[]>([])

  // Telemetry / save material
  const [saveMaterial, setSaveMaterial] = useState(false)
  const [consentModalVisible, setConsentModalVisible] = useState(false)
  const hasShownConsentRef = useRef(false)

  useEffect(() => {
    const fetchExisting = async () => {
      if (!user) return
      const [deckSnap, topicSnap] = await Promise.all([
        getDocs(query(collection(db, 'decks'), where('uid', '==', user.uid))),
        getDocs(query(collection(db, 'topics'), where('uid', '==', user.uid))),
      ])
      setExistingTitles(deckSnap.docs.map((d) => (d.data() as { title: string }).title))
      setExistingTopics(topicSnap.docs.map((d) => (d.data() as { name: string }).name))
    }
    void fetchExisting()
  }, [user])

  // Show telemetry consent modal on first visit if consent not yet given
  useFocusEffect(
    useCallback(() => {
      if (!profile || hasShownConsentRef.current) return
      if (profile.telemetryConsent === undefined) {
        hasShownConsentRef.current = true
        setConsentModalVisible(true)
      }
    }, [profile])
  )

  const handleTelemetryConsent = async (consent: boolean) => {
    setConsentModalVisible(false)
    setSaveMaterial(consent)
    if (!user) return
    try {
      await updateDoc(doc(db, 'users', user.uid), { telemetryConsent: consent })
    } catch (e) {
      console.error('telemetry consent save error', e)
    }
  }

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'image/*',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ]
      })
      if (result.canceled) return
      const asset = result.assets[0]
      setSelectedFile({ name: asset.name, uri: asset.uri, mimeType: asset.mimeType ?? 'application/octet-stream' })
    } catch (e) {
      console.error(e)
    }
  }

  const handleGenerate = () => {
    setError(null)

    if (tab === 'text' && !text.trim()) {
      setError('Please paste some text content.')
      return
    }
    if (tab === 'file' && !selectedFile) {
      setError('Please select a file.')
      return
    }

    const genId = String(Date.now())
    const titleHint = title.trim() || (tab === 'file' ? selectedFile?.name?.replace(/\.[^.]+$/, '') || '' : '')
    startGeneration(genId, titleHint || (tab === 'file' ? 'Processing file…' : 'Generating…'))
    updateStep(genId, tab === 'file' ? 'Reading file…' : 'Starting…')

    // Capture current state for closures
    const capturedUser = user
    const capturedText = text.trim()
    const capturedFile = selectedFile
    const capturedCount = autoCount ? 0 : count
    const capturedTitleHint = titleHint
    const capturedExistingTopics = existingTopics
    const capturedExistingTitles = existingTitles
    const capturedAnswerMode = answerMode
    const capturedSaveMaterial = saveMaterial
    const capturedTab = tab

    const doGenerate = async () => {
      try {
        let cards: { front: string; back: string }[]
        let suggestedTitle: string | null
        let suggestedTopicName: string | null | undefined

        if (capturedTab === 'file' && capturedFile) {
          updateStep(genId, 'Reading file…')
          const file = new FSFile(capturedFile.uri)
          const base64 = await file.base64()
          const result = await generateFromFile({
            files: [{ fileData: base64, mimeType: capturedFile.mimeType, name: capturedFile.name }],
            count: capturedCount,
            title: capturedTitleHint || undefined,
            existingTitles: capturedExistingTitles,
            existingTopics: capturedExistingTopics,
            answerMode: capturedAnswerMode,
          })
          cards = result.cards
          suggestedTitle = result.suggestedTitle
          suggestedTopicName = result.suggestedTopicName
        } else {
          const result = await streamFlashcards(
            {
              text: capturedText,
              count: capturedCount,
              title: capturedTitleHint || undefined,
              existingTitles: capturedExistingTitles,
              existingTopics: capturedExistingTopics,
              answerMode: capturedAnswerMode,
              ...(capturedSaveMaterial ? { saveMaterial: true } : {}),
            },
            (cardCount, targetCount, stepText) => {
              updateStep(genId, stepText)
              if (cardCount > 0 || targetCount > 0) {
                updateCount(genId, cardCount, targetCount)
              }
            }
          )
          cards = result.cards
          suggestedTitle = result.suggestedTitle
          suggestedTopicName = result.suggestedTopicName
        }

        const finalTitle = capturedTitleHint || suggestedTitle || 'Untitled Deck'
        const deckId = await saveDeckToFirestore(
          capturedUser,
          cards,
          finalTitle,
          suggestedTopicName ?? null,
          capturedExistingTopics
        )
        resolveGeneration(genId, deckId, finalTitle, cards.length)
      } catch (err: unknown) {
        const msg = (err as { message?: string }).message || 'Generation failed'
        failGeneration(genId, msg)
      }
    }

    // Store retry function
    setRetryFn(genId, () => {
      updateStep(genId, 'Retrying…')
      void doGenerate()
    })

    // Navigate immediately (fire-and-forget)
    navigation.navigate('Main')

    // Run generation in background
    void doGenerate()
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Generate Deck</Text>

          <View style={styles.tabRow}>
            <TouchableOpacity
              style={[styles.tabBtn, tab === 'text' && styles.tabBtnActive]}
              onPress={() => setTab('text')}
            >
              <FileText color={tab === 'text' ? colors.coral : colors.textMuted} size={16} />
              <Text style={[styles.tabBtnText, tab === 'text' && styles.tabBtnTextActive]}>Text</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabBtn, tab === 'file' && styles.tabBtnActive]}
              onPress={() => setTab('file')}
            >
              <File color={tab === 'file' ? colors.coral : colors.textMuted} size={16} />
              <Text style={[styles.tabBtnText, tab === 'file' && styles.tabBtnTextActive]}>File</Text>
            </TouchableOpacity>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TextInput
            style={styles.input}
            placeholder="Deck title (optional)"
            placeholderTextColor={colors.textMuted}
            value={title}
            onChangeText={setTitle}
          />

          {tab === 'text' ? (
            <TextInput
              style={styles.textarea}
              placeholder="Paste your notes, article, or text content here..."
              placeholderTextColor={colors.textMuted}
              value={text}
              onChangeText={setText}
              multiline
              textAlignVertical="top"
            />
          ) : (
            <TouchableOpacity style={styles.filePicker} onPress={pickFile}>
              {selectedFile ? (
                <>
                  <File color={colors.coral} size={32} />
                  <Text style={styles.fileName}>{selectedFile.name}</Text>
                  <Text style={styles.fileChange}>Tap to change</Text>
                </>
              ) : (
                <>
                  <File color={colors.textMuted} size={32} />
                  <Text style={styles.filePickerText}>Tap to select PDF or image</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          <View style={styles.countRow}>
            <Text style={styles.countLabel}>Cards</Text>
            <View style={styles.countToggleRow}>
              <TouchableOpacity
                style={[styles.countToggleBtn, autoCount && styles.countToggleBtnActive]}
                onPress={() => setAutoCount(true)}
              >
                <Text style={[styles.countToggleBtnText, autoCount && styles.countToggleBtnTextActive]}>Auto</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.countToggleBtn, !autoCount && styles.countToggleBtnActive]}
                onPress={() => setAutoCount(false)}
              >
                <Text style={[styles.countToggleBtnText, !autoCount && styles.countToggleBtnTextActive]}>Set count</Text>
              </TouchableOpacity>
            </View>
            {autoCount ? (
              <Text style={styles.autoCountHelper}>AI decides based on your content</Text>
            ) : (
              <>
                <View style={styles.countButtons}>
                  {[10, 20, 30, 50, 100, 200].map((n) => (
                    <TouchableOpacity
                      key={n}
                      style={[styles.countBtn, count === n && !manualCount && styles.countBtnActive]}
                      onPress={() => { setCount(n); setManualCount('') }}
                    >
                      <Text style={[styles.countBtnText, count === n && !manualCount && styles.countBtnTextActive]}>{n}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  style={styles.manualCountInput}
                  placeholder="Or enter 1–500"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                  value={manualCount}
                  onChangeText={(v) => {
                    const num = parseInt(v, 10)
                    setManualCount(v)
                    if (!isNaN(num) && num >= 1 && num <= 500) setCount(num)
                  }}
                />
              </>
            )}
          </View>

          {/* Answer style */}
          <Text style={styles.countLabel}>Answer Style</Text>
          <View style={styles.countButtons}>
            {(['brief', 'detailed'] as const).map((mode) => (
              <TouchableOpacity
                key={mode}
                style={[styles.countBtn, { paddingHorizontal: 14 }, answerMode === mode && styles.countBtnActive]}
                onPress={() => setAnswerMode(mode)}
              >
                <Text style={[styles.countBtnText, answerMode === mode && styles.countBtnTextActive]}>
                  {mode === 'brief' ? 'Brief (1–5 words)' : 'Detailed'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 4 }}>
            {answerMode === 'brief' ? 'Short answers — great for memorization.' : 'Full explanations — better for complex topics.'}
          </Text>

          {/* Save source material toggle */}
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleLabel}>Save source material</Text>
              <Text style={styles.toggleSubtext}>Helps improve AI results</Text>
            </View>
            <Switch
              value={saveMaterial}
              onValueChange={setSaveMaterial}
              trackColor={{ false: colors.border, true: colors.coral }}
              thumbColor={colors.text}
            />
          </View>

          <TouchableOpacity style={styles.generateBtn} onPress={handleGenerate}>
            <Text style={styles.generateBtnText}>Generate Flashcards</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Telemetry consent modal */}
      <Modal
        visible={consentModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => void handleTelemetryConsent(false)}
      >
        <View style={styles.consentOverlay}>
          <View style={styles.consentCard}>
            <Text style={styles.consentTitle}>Help improve Flipbloom</Text>
            <Text style={styles.consentBody}>
              Allow us to save your source material to improve AI results? You can change this anytime.
            </Text>
            <TouchableOpacity
              style={styles.consentBtnPrimary}
              onPress={() => void handleTelemetryConsent(true)}
            >
              <Text style={styles.consentBtnPrimaryText}>Yes, help out</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.consentBtnSecondary}
              onPress={() => void handleTelemetryConsent(false)}
            >
              <Text style={styles.consentBtnSecondaryText}>No thanks</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 20, gap: 16, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: '800', color: colors.text },
  tabRow: { flexDirection: 'row', gap: 8 },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabBtnActive: { borderColor: colors.coral, backgroundColor: colors.coral + '22' },
  tabBtnText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  tabBtnTextActive: { color: colors.coral },
  errorText: {
    color: colors.danger,
    fontSize: 14,
    padding: 12,
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  input: {
    height: 52,
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 16,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  textarea: {
    height: 180,
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 16,
    fontSize: 15,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filePicker: {
    height: 160,
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  filePickerText: { fontSize: 15, color: colors.textMuted },
  fileName: { fontSize: 15, color: colors.text, fontWeight: '600' },
  fileChange: { fontSize: 12, color: colors.textMuted },
  countRow: { gap: 10 },
  countLabel: { fontSize: 15, fontWeight: '600', color: colors.text },
  countToggleRow: { flexDirection: 'row', gap: 8 },
  countToggleBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  countToggleBtnActive: { backgroundColor: colors.coral + '22', borderColor: colors.coral },
  countToggleBtnText: { fontSize: 14, color: colors.textMuted, fontWeight: '600' },
  countToggleBtnTextActive: { color: colors.coral },
  autoCountHelper: { fontSize: 13, color: colors.textMuted, fontStyle: 'italic' },
  manualCountInput: {
    height: 44,
    backgroundColor: colors.surface,
    borderRadius: 8,
    paddingHorizontal: 14,
    fontSize: 15,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  countButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  countBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  countBtnActive: { backgroundColor: colors.coral + '22', borderColor: colors.coral },
  countBtnText: { fontSize: 14, color: colors.textMuted },
  countBtnTextActive: { color: colors.coral, fontWeight: '600' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  toggleLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
  toggleSubtext: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  generateBtn: {
    height: 52,
    backgroundColor: colors.coral,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  generateBtnText: { fontSize: 16, fontWeight: '700', color: colors.text },
  // Consent modal
  consentOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  consentCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    borderWidth: 1,
    borderColor: colors.border,
    gap: 14,
  },
  consentTitle: { fontSize: 18, fontWeight: '800', color: colors.text, textAlign: 'center' },
  consentBody: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 21 },
  consentBtnPrimary: {
    height: 48,
    backgroundColor: colors.coral,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  consentBtnPrimaryText: { fontSize: 15, fontWeight: '700', color: colors.text },
  consentBtnSecondary: {
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  consentBtnSecondaryText: { fontSize: 14, color: colors.textMuted },
})
