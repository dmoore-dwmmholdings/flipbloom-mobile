import React, { useState, useCallback, useEffect, useRef } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ScrollView,
  Modal,
  ActivityIndicator,
  Alert,
  TextInput,
  Animated,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Plus, X, CheckCircle2, XCircle, Trash2, RotateCcw } from 'lucide-react-native'
import {
  getDocs,
  query,
  where,
  collection,
  db,
  deleteDoc,
  updateDoc,
  increment,
  doc,
  addDoc,
  serverTimestamp,
} from '../lib/firebase'
import { useAuth } from '../lib/AuthContext'
import { colors } from '../lib/colors'
import type { Deck, Topic } from '../lib/types'
import type { RootStackParamList } from '../navigation/types'
import TopicPill from '../components/TopicPill'
import PlanBadge from '../components/PlanBadge'
import { useGeneration } from '../lib/GenerationContext'

type Nav = NativeStackNavigationProp<RootStackParamList>

const TOPIC_COLORS = [
  '#f97316',
  '#3b82f6',
  '#10b981',
  '#8b5cf6',
  '#ec4899',
  '#eab308',
  '#06b6d4',
  '#ef4444',
]

export default function DashboardScreen() {
  const { user, profile } = useAuth()
  const navigation = useNavigation<Nav>()
  const { active, completedAt, dismissGeneration, retryGeneration } = useGeneration()
  const [decks, setDecks] = useState<Deck[]>([])
  const [topics, setTopics] = useState<Topic[]>([])
  const [deckQuizMap, setDeckQuizMap] = useState<Record<string, boolean>>({})
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Generation modal — elapsed timer + progress bar
  const [elapsedSec, setElapsedSec] = useState(0)
  const genProgressAnim = useRef(new Animated.Value(0)).current

  // Animate progress bar when generation starts/ends
  useEffect(() => {
    if (active?.status === 'generating') {
      setElapsedSec(0)
      genProgressAnim.setValue(0)
      Animated.timing(genProgressAnim, {
        toValue: 0.85,
        duration: 45000,
        useNativeDriver: false,
      }).start()
    } else if (active?.status === 'done') {
      Animated.timing(genProgressAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: false,
      }).start()
    }
  }, [active?.status])

  // Update progress bar with real card count from stream
  useEffect(() => {
    if (active?.status !== 'generating') return
    if (!active.liveCardCount || !active.liveTargetCount) return
    const pct = Math.min((active.liveCardCount / active.liveTargetCount) * 0.95, 0.95)
    genProgressAnim.stopAnimation(() => {
      Animated.timing(genProgressAnim, {
        toValue: pct,
        duration: 300,
        useNativeDriver: false,
      }).start()
    })
  }, [active?.liveCardCount, active?.liveTargetCount])

  useEffect(() => {
    if (active?.status !== 'generating') return
    const interval = setInterval(() => {
      if (!active?.startedAt) return
      setElapsedSec(Math.round((Date.now() - active.startedAt) / 1000))
    }, 500)
    return () => clearInterval(interval)
  }, [active?.status, active?.startedAt])

  // Topic creation modal state
  const [topicModalVisible, setTopicModalVisible] = useState(false)
  const [newTopicName, setNewTopicName] = useState('')
  const [newTopicColor, setNewTopicColor] = useState(TOPIC_COLORS[0])

  // Rename modal state
  const [renameModalVisible, setRenameModalVisible] = useState(false)
  const [renamingTopic, setRenamingTopic] = useState<Topic | null>(null)
  const [renameText, setRenameText] = useState('')

  const fetchData = useCallback(async () => {
    if (!user) return
    try {
      const [deckSnap, topicSnap, quizSnap] = await Promise.all([
        getDocs(query(collection(db, 'decks'), where('uid', '==', user.uid))),
        getDocs(query(collection(db, 'topics'), where('uid', '==', user.uid))),
        getDocs(query(collection(db, 'savedQuizzes'), where('uid', '==', user.uid))),
      ])
      const deckList = deckSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Deck))
      deckList.sort((a, b) => {
        const aTime = (a.createdAt as { seconds?: number })?.seconds ?? 0
        const bTime = (b.createdAt as { seconds?: number })?.seconds ?? 0
        return bTime - aTime
      })
      setDecks(deckList)
      setTopics(topicSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Topic)))
      const quizMap: Record<string, boolean> = {}
      quizSnap.docs.forEach((d) => {
        const data = d.data() as { deckId?: string }
        if (data.deckId) quizMap[data.deckId] = true
      })
      setDeckQuizMap(quizMap)
    } catch (e) {
      console.error('fetchData error', e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [user])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  // Refetch when a generation completes so the new deck appears immediately
  useEffect(() => {
    if (completedAt > 0) void fetchData()
  }, [completedAt])

  const onRefresh = () => {
    setRefreshing(true)
    void fetchData()
  }

  // Auto-dismiss generation modal 4s after completion
  useEffect(() => {
    if (active?.status === 'done') {
      const t = setTimeout(() => dismissGeneration(), 4000)
      return () => clearTimeout(t)
    }
  }, [active?.status])

  const handleDeleteDeck = (deckId: string) => {
    Alert.alert(
      'Delete deck?',
      'This will permanently delete all cards in this deck.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const cardSnap = await getDocs(
                query(collection(db, 'cards'), where('deckId', '==', deckId))
              )
              await Promise.all(cardSnap.docs.map((c) => deleteDoc(doc(db, 'cards', c.id))))
              await deleteDoc(doc(db, 'decks', deckId))
              if (user) {
                try {
                  await updateDoc(doc(db, 'users', user.uid), { deckCount: increment(-1) })
                } catch (_) {
                  // silent
                }
              }
              setDecks((prev) => prev.filter((d) => d.id !== deckId))
            } catch (e) {
              console.error('Delete deck error', e)
            }
          },
        },
      ]
    )
  }

  const handleAddTopic = async () => {
    if (!user || !newTopicName.trim()) return
    try {
      const docRef = await addDoc(collection(db, 'topics'), {
        uid: user.uid,
        name: newTopicName.trim(),
        color: newTopicColor,
        createdAt: serverTimestamp(),
      })
      const newTopic: Topic = {
        id: docRef.id,
        name: newTopicName.trim(),
        color: newTopicColor,
        uid: user.uid,
      }
      setTopics((prev) => [...prev, newTopic])
      setNewTopicName('')
      setNewTopicColor(TOPIC_COLORS[0])
      setTopicModalVisible(false)
    } catch (e) {
      console.error('Add topic error', e)
    }
  }

  const handleDeleteTopic = (topic: Topic) => {
    Alert.alert(
      'Delete Topic',
      `Delete "${topic.name}"? Decks in this topic won't be deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'topics', topic.id))
              // Unassign decks from this topic
              const affected = decks.filter((d) => d.topicId === topic.id)
              await Promise.all(
                affected.map((d) => updateDoc(doc(db, 'decks', d.id), { topicId: null, topicName: null }))
              )
              setTopics((prev) => prev.filter((t) => t.id !== topic.id))
              setDecks((prev) =>
                prev.map((d) =>
                  d.topicId === topic.id ? { ...d, topicId: undefined, topicName: undefined } : d
                )
              )
              if (selectedTopic === topic.id) setSelectedTopic(null)
            } catch (e) {
              console.error('Delete topic error', e)
            }
          },
        },
      ]
    )
  }

  const handleRenameTopic = (topic: Topic) => {
    setRenamingTopic(topic)
    setRenameText(topic.name)
    setRenameModalVisible(true)
  }

  const doRenameTopic = async () => {
    if (!renamingTopic || !renameText.trim()) return
    const newName = renameText.trim()
    try {
      await updateDoc(doc(db, 'topics', renamingTopic.id), { name: newName })
      // Update deck documents in Firestore
      const affectedDecks = decks.filter((d) => d.topicId === renamingTopic.id)
      await Promise.all(affectedDecks.map((d) => updateDoc(doc(db, 'decks', d.id), { topicName: newName })))
      // Update local state
      setTopics((prev) => prev.map((t) => t.id === renamingTopic.id ? { ...t, name: newName } : t))
      setDecks((prev) => prev.map((d) => d.topicId === renamingTopic.id ? { ...d, topicName: newName } : d))
      setRenameModalVisible(false)
      setRenamingTopic(null)
      setRenameText('')
    } catch (e) {
      console.error('Rename topic error', e)
    }
  }

  const handleTopicLongPress = (topic: Topic) => {
    Alert.alert(topic.name, 'What would you like to do?', [
      { text: 'Rename', onPress: () => handleRenameTopic(topic) },
      { text: 'Delete', style: 'destructive', onPress: () => handleDeleteTopic(topic) },
      { text: 'Cancel', style: 'cancel' },
    ])
  }

  const filteredDecks = selectedTopic
    ? decks.filter((d) => d.topicId === selectedTopic)
    : decks

  const topicColorMap: Record<string, string> = {}
  topics.forEach((t) => { topicColorMap[t.id] = t.color })

  const renderDeck = ({ item }: { item: Deck }) => (
    <TouchableOpacity
      style={styles.deckCard}
      onPress={() => navigation.navigate('Deck', { deckId: item.id })}
      activeOpacity={0.8}
    >
      <View style={styles.deckHeader}>
        <Text style={styles.deckTitle} numberOfLines={1}>{item.title}</Text>
        <View style={styles.deckHeaderRight}>
          <Text style={styles.cardCount}>{item.cardCount} cards</Text>
          <TouchableOpacity
            onPress={() => handleDeleteDeck(item.id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Trash2 size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>
      {item.topicName ? (
        <View style={styles.deckMeta}>
          <TopicPill
            name={item.topicName}
            color={item.topicId ? topicColorMap[item.topicId] : undefined}
          />
        </View>
      ) : null}
      <View style={styles.deckActions}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => navigation.navigate('Study', { deckId: item.id, deckTitle: item.title })}
        >
          <Text style={styles.actionBtnText}>Study</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnSecondary]}
          onPress={() => navigation.navigate('QuizSetup', { deckId: item.id, deckTitle: item.title })}
        >
          <Text style={deckQuizMap[item.id] ? styles.actionBtnTextQuizExists : styles.actionBtnTextSecondary}>
            {deckQuizMap[item.id] ? 'View Quiz' : 'Quiz'}
          </Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  )

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Library</Text>
          {profile && profile.plan !== 'free' ? (
            <PlanBadge plan={profile.plan} />
          ) : null}
        </View>
        <TouchableOpacity
          style={styles.fab}
          onPress={() => navigation.navigate('Generate' as keyof RootStackParamList & 'Main')}
        >
          <Plus color={colors.text} size={20} />
        </TouchableOpacity>
      </View>

      <View style={styles.topicRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.topicFilters}
          style={styles.topicScroll}
        >
          <TouchableOpacity
            style={[styles.topicChip, selectedTopic === null && styles.topicChipActive]}
            onPress={() => setSelectedTopic(null)}
          >
            <Text style={[styles.topicChipText, selectedTopic === null && styles.topicChipTextActive]}>
              All
            </Text>
          </TouchableOpacity>
          {topics.map((t) => (
            <TouchableOpacity
              key={t.id}
              style={[
                styles.topicChip,
                selectedTopic === t.id && styles.topicChipActive,
                selectedTopic === t.id ? { borderColor: t.color } : {},
              ]}
              onPress={() => setSelectedTopic(selectedTopic === t.id ? null : t.id)}
              onLongPress={() => handleTopicLongPress(t)}
            >
              <Text
                style={[
                  styles.topicChipText,
                  selectedTopic === t.id && { color: t.color },
                ]}
              >
                {t.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TouchableOpacity
          style={styles.addTopicBtn}
          onPress={() => setTopicModalVisible(true)}
        >
          <Plus size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredDecks}
        keyExtractor={(item) => item.id}
        renderItem={renderDeck}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.coral} />}
        ListEmptyComponent={
          loading ? null : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No decks yet</Text>
              <Text style={styles.emptySubtitle}>Generate your first deck to get started.</Text>
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => navigation.navigate('Generate' as keyof RootStackParamList & 'Main')}
              >
                <Text style={styles.emptyBtnText}>Create a deck</Text>
              </TouchableOpacity>
            </View>
          )
        }
      />

      {/* Topic creation modal */}
      <Modal
        visible={topicModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setTopicModalVisible(false)}
      >
        <View style={topicModalStyles.overlay}>
          <View style={topicModalStyles.card}>
            <Text style={topicModalStyles.heading}>New Topic</Text>

            <TextInput
              style={topicModalStyles.input}
              placeholder="Topic name"
              placeholderTextColor={colors.textMuted}
              value={newTopicName}
              onChangeText={setNewTopicName}
              autoFocus
            />

            <View style={topicModalStyles.colorRow}>
              {TOPIC_COLORS.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[
                    topicModalStyles.colorSwatch,
                    { backgroundColor: c },
                    newTopicColor === c && topicModalStyles.colorSwatchSelected,
                  ]}
                  onPress={() => setNewTopicColor(c)}
                />
              ))}
            </View>

            <TouchableOpacity
              style={[
                topicModalStyles.addBtn,
                !newTopicName.trim() && topicModalStyles.addBtnDisabled,
              ]}
              onPress={() => { void handleAddTopic() }}
              disabled={!newTopicName.trim()}
            >
              <Text style={topicModalStyles.addBtnText}>Add Topic</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={topicModalStyles.cancelBtn}
              onPress={() => {
                setTopicModalVisible(false)
                setNewTopicName('')
                setNewTopicColor(TOPIC_COLORS[0])
              }}
            >
              <Text style={topicModalStyles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Topic rename modal */}
      <Modal
        visible={renameModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameModalVisible(false)}
      >
        <View style={topicModalStyles.overlay}>
          <View style={topicModalStyles.card}>
            <Text style={topicModalStyles.heading}>Rename Topic</Text>

            <TextInput
              style={topicModalStyles.input}
              placeholder="Topic name"
              placeholderTextColor={colors.textMuted}
              value={renameText}
              onChangeText={setRenameText}
              autoFocus
            />

            <TouchableOpacity
              style={[
                topicModalStyles.addBtn,
                !renameText.trim() && topicModalStyles.addBtnDisabled,
              ]}
              onPress={() => { void doRenameTopic() }}
              disabled={!renameText.trim()}
            >
              <Text style={topicModalStyles.addBtnText}>Save</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={topicModalStyles.cancelBtn}
              onPress={() => {
                setRenameModalVisible(false)
                setRenamingTopic(null)
                setRenameText('')
              }}
            >
              <Text style={topicModalStyles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Generation Progress Modal */}
      {active && (
        <Modal transparent animationType="fade" visible>
          <View style={genModalStyles.overlay}>
            <View style={genModalStyles.card}>
              <TouchableOpacity onPress={dismissGeneration} style={genModalStyles.closeBtn}>
                <X width={18} height={18} color="#6b7280" />
              </TouchableOpacity>

              {active.status === 'generating' && (
                <>
                  <ActivityIndicator color="#ed674a" size="large" style={{ marginBottom: 16 }} />
                  <Text style={genModalStyles.title}>{active.title}</Text>
                  <Text style={genModalStyles.step}>{active.step}</Text>
                  {active.liveCardCount != null && active.liveTargetCount != null && active.liveTargetCount > 0 ? (
                    <Text style={genModalStyles.elapsed}>{active.liveCardCount} / {active.liveTargetCount} cards</Text>
                  ) : (
                    <Text style={genModalStyles.elapsed}>{elapsedSec}s</Text>
                  )}
                  <View style={genModalStyles.progressTrack}>
                    <Animated.View
                      style={[
                        genModalStyles.progressFill,
                        {
                          width: genProgressAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['0%', '100%'],
                          }),
                        },
                      ]}
                    />
                  </View>
                </>
              )}

              {active.status === 'done' && (
                <>
                  <CheckCircle2 width={40} height={40} color="#4ade80" style={{ alignSelf: 'center', marginBottom: 12 }} />
                  <Text style={[genModalStyles.title, { color: '#4ade80' }]}>Ready!</Text>
                  <Text style={[genModalStyles.title, { color: colors.text, marginTop: 4 }]}>{active.finalTitle || active.title}</Text>
                  {active.resultCardCount != null && (
                    <Text style={genModalStyles.step}>{active.resultCardCount} cards generated</Text>
                  )}
                  {active.resultDeckId && (
                    <TouchableOpacity
                      onPress={() => {
                        dismissGeneration()
                        navigation.navigate('Deck', { deckId: active.resultDeckId! })
                      }}
                      style={genModalStyles.viewBtn}
                    >
                      <Text style={genModalStyles.viewBtnText}>View Deck</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}

              {active.status === 'error' && (
                <>
                  <XCircle width={40} height={40} color="#f87171" style={{ alignSelf: 'center', marginBottom: 12 }} />
                  <Text style={[genModalStyles.title, { color: '#f87171' }]}>Generation failed</Text>
                  <Text style={genModalStyles.step}>{active.error}</Text>
                  {active.retryFn && (
                    <TouchableOpacity
                      onPress={retryGeneration}
                      style={genModalStyles.retryBtn}
                    >
                      <RotateCcw width={14} height={14} color={colors.text} style={{ marginRight: 6 }} />
                      <Text style={genModalStyles.retryBtnText}>Retry</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>
          </View>
        </Modal>
      )}
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
    paddingVertical: 16,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 26, fontWeight: '800', color: colors.text },
  fab: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  topicScroll: { flex: 1, maxHeight: 44 },
  topicFilters: { paddingHorizontal: 20, gap: 8, paddingBottom: 8 },
  topicChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  topicChipActive: { borderColor: colors.coral, backgroundColor: colors.coral + '22' },
  topicChipText: { fontSize: 13, color: colors.textMuted, fontWeight: '500' },
  topicChipTextActive: { color: colors.coral },
  addTopicBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  list: { padding: 20, gap: 12, paddingBottom: 40 },
  deckCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  deckHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  deckHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  deckTitle: { fontSize: 17, fontWeight: '700', color: colors.text, flex: 1, marginRight: 8 },
  cardCount: { fontSize: 13, color: colors.textMuted },
  deckMeta: { flexDirection: 'row' },
  deckActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  actionBtn: {
    flex: 1,
    height: 36,
    backgroundColor: colors.coral,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnSecondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },
  actionBtnText: { fontSize: 14, fontWeight: '600', color: colors.text },
  actionBtnTextSecondary: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  actionBtnTextQuizExists: { fontSize: 14, fontWeight: '600', color: colors.coral },
  emptyState: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
  emptySubtitle: { fontSize: 15, color: colors.textMuted, textAlign: 'center' },
  emptyBtn: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: colors.coral,
    borderRadius: 10,
  },
  emptyBtnText: { fontSize: 15, fontWeight: '700', color: colors.text },
})

const topicModalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 16,
  },
  heading: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  input: {
    backgroundColor: colors.bg,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  colorSwatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  colorSwatchSelected: {
    borderWidth: 2.5,
    borderColor: '#ffffff',
  },
  addBtn: {
    backgroundColor: colors.coral,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  addBtnDisabled: {
    opacity: 0.4,
  },
  addBtnText: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 15,
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  cancelBtnText: {
    color: colors.textMuted,
    fontSize: 14,
  },
})

const genModalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#1e1b1b',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    position: 'relative',
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 4,
  },
  title: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  step: {
    color: '#9ca3af',
    fontSize: 13,
    textAlign: 'center',
  },
  elapsed: {
    color: '#6b7280',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    marginTop: 12,
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ed674a',
  },
  viewBtn: {
    marginTop: 16,
    backgroundColor: '#ed674a',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  viewBtnText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 14,
  },
  retryBtn: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  retryBtnText: {
    color: colors.text,
    fontWeight: '600',
    fontSize: 14,
  },
})
