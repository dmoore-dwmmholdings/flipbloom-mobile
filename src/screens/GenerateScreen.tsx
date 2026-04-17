import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import * as DocumentPicker from 'expo-document-picker'
import { File as FSFile } from 'expo-file-system/next'
import { File, FileText } from 'lucide-react-native'
import { addDoc, collection, db, serverTimestamp, getDocs, query, where } from '../lib/firebase'
import { generateFlashcards, generateFromFile } from '../lib/api'
import { useAuth } from '../lib/AuthContext'
import { colors } from '../lib/colors'
import type { RootStackParamList } from '../navigation/types'
import LoadingSpinner from '../components/LoadingSpinner'

type Nav = NativeStackNavigationProp<RootStackParamList>

export default function GenerateScreen() {
  const { user } = useAuth()
  const navigation = useNavigation<Nav>()
  const [tab, setTab] = useState<'text' | 'file'>('text')
  const [text, setText] = useState('')
  const [count, setCount] = useState(10)
  const [title, setTitle] = useState('')
  const [answerMode, setAnswerMode] = useState<'brief' | 'detailed'>('brief')
  const [selectedFile, setSelectedFile] = useState<{ name: string; uri: string; mimeType: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [progressText, setProgressText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [existingTitles, setExistingTitles] = useState<string[]>([])
  const [existingTopics, setExistingTopics] = useState<string[]>([])

  // Topic suggestion modal
  const [suggestedTitle, setSuggestedTitle] = useState<string | null>(null)
  const [suggestedTopic, setSuggestedTopic] = useState<string | null>(null)
  const [pendingCards, setPendingCards] = useState<{ front: string; back: string }[]>([])
  const [modalVisible, setModalVisible] = useState(false)
  const [finalTitle, setFinalTitle] = useState('')
  const [finalTopic, setFinalTopic] = useState('')

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

  const handleGenerate = async () => {
    setError(null)
    if (tab === 'text' && !text.trim()) {
      setError('Please paste some text content.')
      return
    }
    if (tab === 'file' && !selectedFile) {
      setError('Please select a file.')
      return
    }

    setLoading(true)
    setProgressText(tab === 'file' ? 'Reading file…' : 'Analyzing content…')
    try {
      let result: { cards: { front: string; back: string }[]; suggestedTitle: string | null; suggestedTopicName?: string | null }

      if (tab === 'text') {
        setProgressText('Sending to AI…')
        result = await generateFlashcards({
          text: text.trim(),
          count,
          title: title.trim() || undefined,
          existingTitles,
          existingTopics,
          answerMode,
        })
      } else {
        const file = new FSFile(selectedFile!.uri)
        setProgressText('Reading file…')
        const base64 = await file.base64()
        setProgressText('Sending to AI…')
        result = await generateFromFile({
          files: [{ fileData: base64, mimeType: selectedFile!.mimeType, name: selectedFile!.name }],
          count,
          title: title.trim() || undefined,
          existingTitles,
          existingTopics,
          answerMode,
        })
      }

      setProgressText('Cards ready!')
      setPendingCards(result.cards)
      setSuggestedTitle(result.suggestedTitle)
      setSuggestedTopic(result.suggestedTopicName ?? null)
      setFinalTitle(title.trim() || result.suggestedTitle || '')
      setFinalTopic(result.suggestedTopicName ?? '')
      setModalVisible(true)
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      setError(message)
    } finally {
      setLoading(false)
      setProgressText('')
    }
  }

  const handleSaveDeck = async (topicDecision: 'accept' | 'rename' | 'skip') => {
    if (!user) return
    setModalVisible(false)
    setLoading(true)
    try {
      let topicId: string | null = null
      let topicName: string | null = null

      if (topicDecision !== 'skip' && finalTopic.trim()) {
        // Find or create topic
        const topicSnap = await getDocs(
          query(collection(db, 'topics'), where('uid', '==', user.uid), where('name', '==', finalTopic.trim()))
        )
        if (!topicSnap.empty) {
          topicId = topicSnap.docs[0].id
          topicName = finalTopic.trim()
        } else {
          const topicColors = ['#ed674a', '#f49f48', '#4ade80', '#60a5fa', '#a78bfa', '#f472b6']
          const color = topicColors[existingTopics.length % topicColors.length]
          const newTopic = await addDoc(collection(db, 'topics'), {
            uid: user.uid,
            name: finalTopic.trim(),
            color,
            createdAt: serverTimestamp(),
          })
          topicId = newTopic.id
          topicName = finalTopic.trim()
        }
      }

      const deckRef = await addDoc(collection(db, 'decks'), {
        uid: user.uid,
        title: finalTitle.trim() || 'Untitled Deck',
        cardCount: pendingCards.length,
        topicId,
        topicName,
        createdAt: serverTimestamp(),
      })

      const cardPromises = pendingCards.map((card, idx) =>
        addDoc(collection(db, 'cards'), {
          uid: user.uid,
          deckId: deckRef.id,
          front: card.front,
          back: card.back,
          order: idx,
        })
      )
      await Promise.all(cardPromises)

      navigation.navigate('Deck', { deckId: deckRef.id })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      Alert.alert('Error', message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    const steps = [
      { label: 'Reading content', done: progressText !== 'Reading file…' && progressText !== 'Analyzing content…' },
      { label: 'Sending to AI', done: progressText === 'Cards ready!' },
      { label: 'Building cards', done: progressText === 'Cards ready!' },
    ]
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingContainer}>
          <LoadingSpinner />
          <Text style={styles.loadingTitle}>{progressText || 'Working…'}</Text>
          <Text style={styles.loadingSubtitle}>
            {count} card{count !== 1 ? 's' : ''} · {answerMode === 'brief' ? 'Brief answers' : 'Detailed answers'}
          </Text>
          <View style={styles.stepsRow}>
            {steps.map((s, i) => (
              <View key={i} style={styles.stepItem}>
                <View style={[styles.stepDot, s.done && styles.stepDotDone]} />
                <Text style={[styles.stepLabel, s.done && styles.stepLabelDone]}>{s.label}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.loadingHint}>You can switch tabs — this will finish in the background.</Text>
        </View>
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
            <Text style={styles.countLabel}>Cards: {count}</Text>
            <View style={styles.countButtons}>
              {[5, 10, 15, 20, 30, 50].map((n) => (
                <TouchableOpacity
                  key={n}
                  style={[styles.countBtn, count === n && styles.countBtnActive]}
                  onPress={() => setCount(n)}
                >
                  <Text style={[styles.countBtnText, count === n && styles.countBtnTextActive]}>{n}</Text>
                </TouchableOpacity>
              ))}
            </View>
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
          <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 16 }}>
            {answerMode === 'brief' ? 'Short answers — great for memorization.' : 'Full explanations — better for complex topics.'}
          </Text>

          <TouchableOpacity style={styles.generateBtn} onPress={handleGenerate}>
            <Text style={styles.generateBtnText}>Generate Flashcards</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Save Deck</Text>

            <Text style={styles.modalLabel}>Deck Title</Text>
            <TextInput
              style={styles.input}
              value={finalTitle}
              onChangeText={setFinalTitle}
              placeholder="Deck title"
              placeholderTextColor={colors.textMuted}
            />

            {suggestedTopic ? (
              <>
                <Text style={styles.modalLabel}>Suggested Topic: <Text style={{ color: colors.coral }}>{suggestedTopic}</Text></Text>
                <TextInput
                  style={styles.input}
                  value={finalTopic}
                  onChangeText={setFinalTopic}
                  placeholder="Topic name (or leave blank to skip)"
                  placeholderTextColor={colors.textMuted}
                />
              </>
            ) : null}

            <Text style={styles.cardPreview}>{pendingCards.length} cards generated</Text>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => handleSaveDeck(finalTopic.trim() ? 'accept' : 'skip')}
              >
                <Text style={styles.primaryBtnText}>Save Deck</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
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
  generateBtn: {
    height: 52,
    backgroundColor: colors.coral,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  generateBtnText: { fontSize: 16, fontWeight: '700', color: colors.text },
  loadingText: {
    position: 'absolute',
    bottom: 80,
    alignSelf: 'center',
    color: colors.textMuted,
    fontSize: 15,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 8,
  },
  loadingTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginTop: 16,
  },
  loadingSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 8,
  },
  stepsRow: {
    flexDirection: 'row',
    gap: 20,
    marginVertical: 16,
    alignItems: 'center',
  },
  stepItem: { alignItems: 'center', gap: 6 },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  stepDotDone: { backgroundColor: colors.coral, borderColor: colors.coral },
  stepLabel: { fontSize: 11, color: colors.textMuted },
  stepLabelDone: { color: colors.coral },
  loadingHint: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
    textAlign: 'center',
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    gap: 14,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  modalLabel: { fontSize: 14, color: colors.textMuted },
  cardPreview: { fontSize: 14, color: colors.coral, fontWeight: '600' },
  modalActions: { gap: 10 },
  primaryBtn: {
    height: 52,
    backgroundColor: colors.coral,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { fontSize: 16, fontWeight: '700', color: colors.text },
  secondaryBtn: {
    height: 52,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryBtnText: { fontSize: 16, fontWeight: '600', color: colors.textMuted },
})
