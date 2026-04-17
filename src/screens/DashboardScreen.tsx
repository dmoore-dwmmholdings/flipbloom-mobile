import React, { useState, useCallback, useEffect } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Plus } from 'lucide-react-native'
import { getDocs, query, where, collection, db } from '../lib/firebase'
import { useAuth } from '../lib/AuthContext'
import { colors } from '../lib/colors'
import type { Deck, Topic } from '../lib/types'
import type { RootStackParamList } from '../navigation/types'
import TopicPill from '../components/TopicPill'
import PlanBadge from '../components/PlanBadge'

type Nav = NativeStackNavigationProp<RootStackParamList>

export default function DashboardScreen() {
  const { user, profile } = useAuth()
  const navigation = useNavigation<Nav>()
  const [decks, setDecks] = useState<Deck[]>([])
  const [topics, setTopics] = useState<Topic[]>([])
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = useCallback(async () => {
    if (!user) return
    try {
      const [deckSnap, topicSnap] = await Promise.all([
        getDocs(query(collection(db, 'decks'), where('uid', '==', user.uid))),
        getDocs(query(collection(db, 'topics'), where('uid', '==', user.uid))),
      ])
      const deckList = deckSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Deck))
      deckList.sort((a, b) => {
        const aTime = (a.createdAt as { seconds?: number })?.seconds ?? 0
        const bTime = (b.createdAt as { seconds?: number })?.seconds ?? 0
        return bTime - aTime
      })
      setDecks(deckList)
      setTopics(topicSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Topic)))
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

  const onRefresh = () => {
    setRefreshing(true)
    void fetchData()
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
        <Text style={styles.cardCount}>{item.cardCount} cards</Text>
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
          <Text style={styles.actionBtnTextSecondary}>Quiz</Text>
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

      {topics.length > 0 ? (
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
      ) : null}

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
  topicScroll: { maxHeight: 44 },
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
