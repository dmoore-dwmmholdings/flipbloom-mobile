import React, { useState } from 'react'
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated'
import { colors } from '../lib/colors'

interface FlipCardProps {
  front: string
  back: string
  onFlip?: (isFlipped: boolean) => void
}

export default function FlipCard({ front, back, onFlip }: FlipCardProps) {
  const [isFlipped, setIsFlipped] = useState(false)
  const rotation = useSharedValue(0)

  const frontAnimatedStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(
      rotation.value,
      [0, 1],
      [0, 180],
      Extrapolation.CLAMP
    )
    return {
      transform: [{ rotateY: `${rotateY}deg` }],
      backfaceVisibility: 'hidden',
    }
  })

  const backAnimatedStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(
      rotation.value,
      [0, 1],
      [180, 360],
      Extrapolation.CLAMP
    )
    return {
      transform: [{ rotateY: `${rotateY}deg` }],
      backfaceVisibility: 'hidden',
    }
  })

  const handleFlip = () => {
    const next = isFlipped ? 0 : 1
    rotation.value = withTiming(next, { duration: 400 })
    setIsFlipped(!isFlipped)
    onFlip?.(!isFlipped)
  }

  return (
    <TouchableOpacity style={styles.container} onPress={handleFlip} activeOpacity={1}>
      <View style={styles.cardWrapper}>
        <Animated.View style={[styles.card, styles.front, frontAnimatedStyle]}>
          <Text style={styles.label}>FRONT</Text>
          <Text style={styles.text}>{front}</Text>
          <Text style={styles.hint}>Tap to reveal answer</Text>
        </Animated.View>
        <Animated.View style={[styles.card, styles.back, backAnimatedStyle]}>
          <Text style={[styles.label, styles.backLabel]}>BACK</Text>
          <Text style={styles.text}>{back}</Text>
        </Animated.View>
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    aspectRatio: 1.5,
  },
  cardWrapper: {
    flex: 1,
    position: 'relative',
  },
  card: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  front: {
    backgroundColor: colors.surface,
  },
  back: {
    backgroundColor: '#271a0e',
    borderColor: colors.coral,
  },
  label: {
    position: 'absolute',
    top: 16,
    left: 16,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.textMuted,
  },
  backLabel: {
    color: colors.coral,
  },
  text: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
    lineHeight: 26,
  },
  hint: {
    position: 'absolute',
    bottom: 16,
    fontSize: 12,
    color: colors.textMuted,
  },
})
