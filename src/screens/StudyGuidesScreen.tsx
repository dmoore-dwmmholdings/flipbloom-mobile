import React, { useState, useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation, useFocusEffect } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Plus, BookMarked } from 'lucide-react-native'
import { getDocs, query, where, collection, db, addDoc, serverTimestamp } from '../lib/firebase'
import { generateStudyGuide } from '../lib/api'
import { useAuth } from '../lib/AuthContext'
import { useGeneration } from '../lib/GenerationContext'
import { colors } from '../lib/colors'
import type { StudyGuide, Deck, PRO_GUIDE_LIMIT, MAX_GUIDE_LIMIT } from '../lib/types'
import { PRO_GUIDE_LIMIT as PRO_LIMIT, MAX_GUIDE_LIMIT as MAX_LIMIT } from '../lib/types'
import type { RootStackParamList } from '../navigation/types'
import LoadingSpinner from '../components/LoadingSpinner'

type Nav = NativeStackNavigationProp<RootStackParamList>

type SourceType = 'text' | 'deck' | 'topic'

export default function StudyGuidesScreen() {
  const { user, profile, isPro, isMax } = useAuth()
  const navigation = useNavigation<Nav>()
  const [guides, setGuides] = useState<StudyGuide[]>([])
  const [decks, setDecks] = useState<Deck[]>([])
  const [loading, setLoading] = useState(true)
  const [modalVisible, setModalVisible] = useState(false)
  const { startGeneration, updateStep, resolveGeneration, failGeneration } = useGeneration()

  // Form state
  const [sourceType, setSourceType] = useState<SourceType>('text')
  const [text, setText] = useState('')
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null)
  const [guideTitle, setGuideTitle] = useState('')

  const guideLimit = isMax ? MAX_LIMIT : PRO_LIMIT

  const fetchData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const [guideSnap, deckSnap] = await Promise.all([
        getDocs(query(collection(db, 'studyGuides'), where('uid', '==', user.uid))),
        getDocs(query(collection(db, 'decks'), where('uid', '==', user.uid))),
      ])
      setGuides(guideSnap.docs.map((d) => ({ id: d.id, ...d.data() } as StudyGuide)))
      setDecks(deckSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Deck)))
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [user])

  useFocusEffect(
    useCallback(() => {
      void fetchData()
    }, [fetchData])
  )

  const handleGenerate = () => {
    if (sourceType === 'text' && !text.trim()) {
      Alert.alert('Error', 'Please enter some text content.')
      return
    }
    if (sourceType === 'deck' && !selectedDeckId) {
      Alert.alert('Error', 'Please select a deck.')
      return
    }

    const genId = String(Date.now())
    const title = guideTitle.trim() || 'Study Guide'
    startGeneration(genId, title)
    updateStep(genId, 'Generating with AI…')
    setModalVisible(false)

    generateStudyGuide({
      text: sourceType === 'text' ? text.trim() : undefined,
      deckId: sourceType === 'deck' ? selectedDeckId ?? undefined : undefined,
      title: guideTitle.trim() || undefined,
    })
      .then(result => {
        return addDoc(collection(db, 'studyGuides'), {
          uid: user!.uid,
          title: result.title,
          sourceType,
          content: result.content,
          topicId: null,
          topicName: null,
          createdAt: serverTimestamp(),
        }).then(guideRef => {
          resolveGeneration(genId, guideRef.id)
          void fetchData()
        })
      })
      .catch((e: Error) => failGeneration(genId, e.message || 'Guide generation failed'))
  }

  const renderGuide = ({ item }: { item: StudyGuide }) => {
    const date = item.createdAt
      ? new Date(((item.createdAt as { seconds?: number }).seconds ?? 0) * 1000).toLocaleDateString()
      : '—'
    return (
      <TouchableOpacity
        style={styles.guideCard}
        onPress={() => navigation.navigate('StudyGuideView', { guideId: item.id })}
      >
        <View style={styles.guideIcon}>
          <BookMarked color={colors.coral} size={20} />
        </View>
        <View style={styles.guideInfo}>
          <Text style={styles.guideTitle} numberOfLines={2}>{item.title}</Text>
          <Text style={styles.guideMeta}>
            {item.content.sections.length} sections · {date}
          </Text>
        </View>
      </TouchableOpacity>
    )
  }

  // Free users see the tab but can't generate



  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Study Guides</Text>
          <Text style={{ fontSize: 10, color: '#666', marginTop: 2 }}>build v2</Text>
          <Text style={styles.usage}>
            {guides.length} / {guideLimit} guides used
          </Text>
        </View>
        {isPro && guides.length < guideLimit ? (
          <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
            <Plus color={colors.text} size={20} />
          </TouchableOpacity>
        ) : null}
      </View>

      <FlatList
        data={guides}
        keyExtractor={(item) => item.id}
        renderItem={renderGuide}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          loading ? null : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No guides yet</Text>
              {isPro ? (
                <>
                  <Text style={styles.emptyText}>Create your first study guide</Text>
                  <TouchableOpacity style={styles.emptyBtn} onPress={() => setModalVisible(true)}>
                    <Text style={styles.emptyBtnText}>New Guide</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.emptyText}>Upgrade to Pro to generate AI study guides.</Text>
                  <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.navigate('Pricing')}>
                    <Text style={styles.emptyBtnText}>Upgrade to Pro</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )
        }
      />

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1, justifyContent: 'flex-end' }}
          >
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>New Study Guide</Text>

              <View style={styles.sourceTypes}>
                {(['text', 'deck'] as SourceType[]).map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.typeBtn, sourceType === t && styles.typeBtnActive]}
                    onPress={() => setSourceType(t)}
                  >
                    <Text style={[styles.typeBtnText, sourceType === t && styles.typeBtnTextActive]}>
                      {t === 'text' ? 'From Text' : 'From Deck'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                style={styles.input}
                placeholder="Guide title (optional)"
                placeholderTextColor={colors.textMuted}
                value={guideTitle}
                onChangeText={setGuideTitle}
              />

              {sourceType === 'text' ? (
                <TextInput
                  style={styles.textarea}
                  placeholder="Paste your notes or content here..."
                  placeholderTextColor={colors.textMuted}
                  value={text}
                  onChangeText={setText}
                  multiline
                  textAlignVertical="top"
                />
              ) : (
                <ScrollView style={styles.deckList} nestedScrollEnabled>
                  {decks.map((d) => (
                    <TouchableOpacity
                      key={d.id}
                      style={[styles.deckOption, selectedDeckId === d.id && styles.deckOptionActive]}
                      onPress={() => setSelectedDeckId(d.id)}
                    >
                      <Text style={[styles.deckOptionText, selectedDeckId === d.id && styles.deckOptionTextActive]}>
                        {d.title}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.generateBtn} onPress={() => void handleGenerate()}>
                  <Text style={styles.generateBtnText}>Generate Guide</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 8,
  },
  title: { fontSize: 26, fontWeight: '800', color: colors.text },
  usage: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  fab: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { padding: 20, gap: 12, paddingBottom: 40 },
  guideCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  guideIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.coral + '22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideInfo: { flex: 1, gap: 4 },
  guideTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  guideMeta: { fontSize: 12, color: colors.textMuted },
  emptyState: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
  emptyText: { fontSize: 15, color: colors.textMuted },
  emptyBtn: { marginTop: 8, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: colors.coral, borderRadius: 10 },
  emptyBtnText: { fontSize: 15, fontWeight: '700', color: colors.text },
  upsellContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 16 },
  upsellTitle: { fontSize: 24, fontWeight: '800', color: colors.text },
  upsellText: { fontSize: 15, color: colors.textMuted, textAlign: 'center', lineHeight: 22 },
  upsellBtn: { paddingHorizontal: 32, paddingVertical: 14, backgroundColor: colors.coral, borderRadius: 12 },
  upsellBtnText: { fontSize: 16, fontWeight: '700', color: colors.text },
  generatingText: {
    position: 'absolute',
    bottom: 80,
    alignSelf: 'center',
    color: colors.textMuted,
    fontSize: 15,
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)' },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    gap: 14,
    maxHeight: '80%',
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  sourceTypes: { flexDirection: 'row', gap: 8 },
  typeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  typeBtnActive: { borderColor: colors.coral, backgroundColor: colors.coral + '22' },
  typeBtnText: { fontSize: 14, color: colors.textMuted, fontWeight: '600' },
  typeBtnTextActive: { color: colors.coral },
  input: {
    height: 48,
    backgroundColor: colors.bg,
    borderRadius: 8,
    paddingHorizontal: 14,
    fontSize: 15,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  textarea: {
    height: 120,
    backgroundColor: colors.bg,
    borderRadius: 8,
    padding: 14,
    fontSize: 15,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  deckList: { maxHeight: 150 },
  deckOption: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 6,
  },
  deckOptionActive: { borderColor: colors.coral, backgroundColor: colors.coral + '22' },
  deckOptionText: { fontSize: 14, color: colors.textMuted },
  deckOptionTextActive: { color: colors.coral, fontWeight: '600' },
  modalActions: { gap: 10 },
  generateBtn: {
    height: 48,
    backgroundColor: colors.coral,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  generateBtnText: { fontSize: 15, fontWeight: '700', color: colors.text },
  cancelBtn: {
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: colors.textMuted },
})
