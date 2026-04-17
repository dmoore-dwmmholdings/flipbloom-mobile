import React, { useEffect, useRef } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { CheckCircle } from 'lucide-react-native'
import { colors } from '../lib/colors'
import type { RootStackParamList } from '../navigation/types'

type Nav = NativeStackNavigationProp<RootStackParamList>
type Route = RouteProp<RootStackParamList, 'StudyComplete'>

const { width: SCREEN_W } = Dimensions.get('window')

// Confetti particle
function Particle({ delay, color }: { delay: number; color: string }) {
  const y = useRef(new Animated.Value(-20)).current
  const x = useRef(new Animated.Value(0)).current
  const opacity = useRef(new Animated.Value(0)).current
  const rotate = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const randomX = (Math.random() - 0.5) * SCREEN_W * 0.9
    const randomDuration = 1400 + Math.random() * 800

    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(y, { toValue: 700, duration: randomDuration, useNativeDriver: true }),
        Animated.timing(x, { toValue: randomX, duration: randomDuration, useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 1, duration: 100, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 300, delay: randomDuration - 400, useNativeDriver: true }),
        ]),
        Animated.timing(rotate, { toValue: 3, duration: randomDuration, useNativeDriver: true }),
      ]),
    ]).start()
  }, [])

  const spin = rotate.interpolate({ inputRange: [0, 3], outputRange: ['0deg', '1080deg'] })

  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: 0,
        left: SCREEN_W / 2,
        width: 10,
        height: 10,
        borderRadius: Math.random() > 0.5 ? 5 : 2,
        backgroundColor: color,
        opacity,
        transform: [{ translateY: y }, { translateX: x }, { rotate: spin }],
      }}
    />
  )
}

const CONFETTI_COLORS = ['#ed674a', '#f49f48', '#4ade80', '#60a5fa', '#a78bfa', '#f472b6', '#fbbf24']

export default function StudyCompleteScreen() {
  const navigation = useNavigation<Nav>()
  const route = useRoute<Route>()
  const { deckId, deckTitle, knownCount, unknownCount, totalCards } = route.params

  const scaleAnim = useRef(new Animated.Value(0.6)).current
  const opacityAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 60,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start()
  }, [])

  const mastery = Math.round((knownCount / totalCards) * 100)
  const particles = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    delay: i * 60,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  }))

  return (
    <SafeAreaView style={styles.safe}>
      {/* Confetti */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {particles.map((p) => (
          <Particle key={p.id} delay={p.delay} color={p.color} />
        ))}
      </View>

      <Animated.View style={[styles.container, { opacity: opacityAnim, transform: [{ scale: scaleAnim }] }]}>
        {/* Check icon */}
        <View style={styles.iconWrap}>
          <CheckCircle size={56} color="#4ade80" strokeWidth={1.5} />
        </View>

        <Text style={styles.title}>Session Complete!</Text>
        <Text style={styles.deckName}>{deckTitle}</Text>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{knownCount}</Text>
            <Text style={styles.statLabel}>Known</Text>
          </View>
          <View style={[styles.statCard, styles.statDivider]}>
            <Text style={[styles.statValue, { color: '#f87171' }]}>{unknownCount}</Text>
            <Text style={styles.statLabel}>Missed</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: mastery >= 80 ? '#4ade80' : mastery >= 60 ? '#fbbf24' : '#f87171' }]}>
              {mastery}%
            </Text>
            <Text style={styles.statLabel}>Mastery</Text>
          </View>
        </View>

        {/* Encouragement */}
        <Text style={styles.message}>
          {mastery === 100
            ? 'Perfect round — flawless!'
            : mastery >= 80
            ? 'Solid session. Keep it up!'
            : mastery >= 60
            ? 'Getting there — keep reviewing!'
            : 'Keep pushing, you\'ll get it!'}
        </Text>

        <TouchableOpacity style={styles.doneBtn} onPress={() => navigation.navigate('Main')}>
          <Text style={styles.doneBtnText}>Back to Library</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.studyAgainBtn}
          onPress={() => navigation.replace('Study', { deckId, deckTitle })}
        >
          <Text style={styles.studyAgainBtnText}>Study Again</Text>
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(74,222,128,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  deckName: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    width: '100%',
    marginVertical: 8,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 20,
    gap: 4,
  },
  statDivider: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#4ade80',
  },
  statLabel: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  message: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 8,
  },
  doneBtn: {
    width: '100%',
    height: 52,
    backgroundColor: colors.coral,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  doneBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  studyAgainBtn: {
    width: '100%',
    height: 48,
    backgroundColor: colors.surface,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  studyAgainBtnText: { fontSize: 15, fontWeight: '600', color: colors.textMuted },
})
