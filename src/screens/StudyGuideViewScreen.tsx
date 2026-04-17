import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRoute, RouteProp } from '@react-navigation/native'
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'
import { Share2 } from 'lucide-react-native'
import { getDoc, doc, db } from '../lib/firebase'
import { colors } from '../lib/colors'
import type { StudyGuide } from '../lib/types'
import type { RootStackParamList } from '../navigation/types'

type Route = RouteProp<RootStackParamList, 'StudyGuideView'>

export default function StudyGuideViewScreen() {
  const route = useRoute<Route>()
  const { guideId } = route.params
  const [guide, setGuide] = useState<StudyGuide | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    const fetchGuide = async () => {
      try {
        const snap = await getDoc(doc(db, 'studyGuides', guideId))
        if (snap.exists()) {
          setGuide({ id: snap.id, ...snap.data() } as StudyGuide)
        }
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    void fetchGuide()
  }, [guideId])

  const handleExport = async () => {
    if (!guide) return
    setExporting(true)
    try {
      const sectionsHtml = guide.content.sections
        .map((s) => `
          <h2 style="color: #ed674a; margin-top: 24px;">${s.heading}</h2>
          <p>${s.body}</p>
          ${s.bullets ? `<ul>${s.bullets.map((b) => `<li>${b}</li>`).join('')}</ul>` : ''}
          ${s.keyTerms ? s.keyTerms.map((kt) => `<p><strong>${kt.term}:</strong> ${kt.definition}</p>`).join('') : ''}
          ${s.examples ? `<p><em>Examples: ${s.examples.join(', ')}</em></p>` : ''}
        `)
        .join('')

      const takeawaysHtml = guide.content.keyTakeaways
        .map((t) => `<li>${t}</li>`)
        .join('')

      const html = `
        <html>
          <body style="font-family: Georgia, serif; padding: 40px; color: #333; line-height: 1.6;">
            <h1 style="font-size: 28px; color: #1a1a1a;">${guide.content.title}</h1>
            ${guide.content.subtitle ? `<h3 style="color: #666;">${guide.content.subtitle}</h3>` : ''}
            <p style="font-size: 16px; color: #555;">${guide.content.overview}</p>
            ${sectionsHtml}
            <h2 style="color: #ed674a; margin-top: 32px;">Key Takeaways</h2>
            <ul>${takeawaysHtml}</ul>
            <h2 style="color: #ed674a;">Summary</h2>
            <p>${guide.content.summary}</p>
          </body>
        </html>
      `

      const { uri } = await Print.printToFileAsync({ html })
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Export Study Guide',
      })
    } catch (e) {
      const err = e as Error
      Alert.alert('Export Error', err.message)
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator style={{ marginTop: 60 }} color={colors.coral} size="large" />
      </SafeAreaView>
    )
  }

  if (!guide) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.notFound}>Guide not found.</Text>
      </SafeAreaView>
    )
  }

  const { content } = guide

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.guideTitle}>{content.title}</Text>
            {content.subtitle ? <Text style={styles.guideSubtitle}>{content.subtitle}</Text> : null}
          </View>
          <TouchableOpacity
            style={[styles.exportBtn, exporting && styles.btnDisabled]}
            onPress={() => void handleExport()}
            disabled={exporting}
          >
            {exporting
              ? <ActivityIndicator size="small" color={colors.coral} />
              : <Share2 size={18} color={colors.coral} />
            }
          </TouchableOpacity>
        </View>

        <View style={styles.overviewCard}>
          <Text style={styles.sectionLabel}>OVERVIEW</Text>
          <Text style={styles.overviewText}>{content.overview}</Text>
        </View>

        {content.sections.map((section, idx) => (
          <View key={idx} style={styles.sectionCard}>
            <Text style={styles.sectionHeading}>{section.heading}</Text>
            <Text style={styles.sectionBody}>{section.body}</Text>

            {section.bullets && section.bullets.length > 0 ? (
              <View style={styles.bulletList}>
                {section.bullets.map((b, bIdx) => (
                  <View key={bIdx} style={styles.bulletItem}>
                    <Text style={styles.bulletDot}>•</Text>
                    <Text style={styles.bulletText}>{b}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {section.keyTerms && section.keyTerms.length > 0 ? (
              <View style={styles.keyTermsList}>
                <Text style={styles.keyTermsLabel}>KEY TERMS</Text>
                {section.keyTerms.map((kt, ktIdx) => (
                  <View key={ktIdx} style={styles.keyTermItem}>
                    <Text style={styles.keyTermTerm}>{kt.term}</Text>
                    <Text style={styles.keyTermDef}>{kt.definition}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {section.examples && section.examples.length > 0 ? (
              <View style={styles.examplesList}>
                <Text style={styles.examplesLabel}>EXAMPLES</Text>
                {section.examples.map((e, eIdx) => (
                  <Text key={eIdx} style={styles.exampleText}>— {e}</Text>
                ))}
              </View>
            ) : null}
          </View>
        ))}

        {content.keyTakeaways.length > 0 ? (
          <View style={styles.takeawaysCard}>
            <Text style={styles.takeawaysLabel}>KEY TAKEAWAYS</Text>
            {content.keyTakeaways.map((t, idx) => (
              <View key={idx} style={styles.takeawayItem}>
                <Text style={styles.takeawayNum}>{idx + 1}</Text>
                <Text style={styles.takeawayText}>{t}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.summaryCard}>
          <Text style={styles.sectionLabel}>SUMMARY</Text>
          <Text style={styles.summaryText}>{content.summary}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 20, gap: 14, paddingBottom: 40 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  guideTitle: { fontSize: 26, fontWeight: '800', color: colors.text, lineHeight: 32 },
  guideSubtitle: { fontSize: 15, color: colors.textMuted, marginTop: 4 },
  exportBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.5 },
  overviewCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1, color: colors.coral },
  overviewText: { fontSize: 15, color: colors.text, lineHeight: 23 },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  sectionHeading: { fontSize: 18, fontWeight: '700', color: colors.coral },
  sectionBody: { fontSize: 14, color: colors.text, lineHeight: 22 },
  bulletList: { gap: 6 },
  bulletItem: { flexDirection: 'row', gap: 8 },
  bulletDot: { color: colors.coral, fontSize: 14, lineHeight: 22 },
  bulletText: { flex: 1, fontSize: 14, color: colors.text, lineHeight: 22 },
  keyTermsList: { gap: 8 },
  keyTermsLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1, color: colors.textMuted },
  keyTermItem: { gap: 2 },
  keyTermTerm: { fontSize: 14, fontWeight: '700', color: colors.amber },
  keyTermDef: { fontSize: 14, color: colors.text, lineHeight: 20 },
  examplesList: { gap: 6 },
  examplesLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1, color: colors.textMuted },
  exampleText: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
  takeawaysCard: {
    backgroundColor: colors.coral + '11',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.coral + '44',
    gap: 12,
  },
  takeawaysLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1, color: colors.coral },
  takeawayItem: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  takeawayNum: { fontSize: 13, fontWeight: '800', color: colors.coral, width: 20 },
  takeawayText: { flex: 1, fontSize: 14, color: colors.text, lineHeight: 21 },
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  summaryText: { fontSize: 14, color: colors.text, lineHeight: 22 },
  notFound: { textAlign: 'center', color: colors.textMuted, marginTop: 60 },
})
