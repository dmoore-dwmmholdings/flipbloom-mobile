import { auth } from './firebase'
import type { QuizQuestion, QuizAnswer, StudyGuideContent } from './types'

const BASE = 'https://flipbloom-api.vercel.app'

async function callApi<T>(endpoint: string, data: Record<string, unknown>, attempt = 0): Promise<T> {
  const user = auth.currentUser
  if (!user) throw new Error('Not authenticated')
  const idToken = await user.getIdToken()

  let res: Response
  try {
    res = await fetch(`${BASE}/api/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`,
      },
      body: JSON.stringify(data),
    })
  } catch {
    // Network error (cold start) — retry once
    if (attempt === 0) return callApi<T>(endpoint, data, 1)
    throw new Error('Network error — please check your connection and try again.')
  }

  if (!res.ok) {
    const json = await res.json().catch(() => null)
    const msg = json?.error?.message ?? json?.error ?? res.statusText ?? 'Unknown error'
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg))
  }
  return res.json() as Promise<T>
}

export const generateFlashcards = (data: {
  text: string
  count: number
  title?: string
  existingTitles?: string[]
  existingTopics?: string[]
  answerMode?: 'brief' | 'detailed'
}) =>
  callApi<{
    cards: { front: string; back: string }[]
    suggestedTitle: string | null
    suggestedTopicName?: string | null
  }>('generateFlashcards', data as unknown as Record<string, unknown>)

export const generateFromFile = (data: {
  files?: { fileData: string; mimeType: string; name: string }[]
  fileData?: string
  mimeType?: string
  count: number
  title?: string
  existingTitles?: string[]
  existingTopics?: string[]
  answerMode?: 'brief' | 'detailed'
}) =>
  callApi<{
    cards: { front: string; back: string }[]
    suggestedTitle: string | null
    suggestedTopicName?: string | null
  }>('generateFromFile', data as unknown as Record<string, unknown>)

export const generateQuiz = (data: {
  deckId?: string
  text?: string
  fileData?: string
  mimeType?: string
  count: number
  types: string[]
}) =>
  callApi<{ questions: QuizQuestion[]; deckTitle?: string }>(
    'generateQuiz',
    data as unknown as Record<string, unknown>
  )

export const saveStudySession = (data: {
  deckId: string
  deckTitle: string
  knownCount: number
  unknownCount: number
  totalCards: number
  duration?: number
  cardResults?: unknown[]
  topicId?: string | null
  topicName?: string | null
}) => callApi<{ id: string }>('saveStudySession', data as unknown as Record<string, unknown>)

export const saveQuizSession = (data: {
  quizId: string
  quizTitle: string
  score: number
  totalQuestions: number
  answers: unknown[]
}) => callApi<{ id: string }>('saveQuizSession', data as unknown as Record<string, unknown>)

export const getSubscriptionInfo = () =>
  callApi<{
    plan: string
    status?: string
    currentPeriodEnd?: number
    cancelAtPeriodEnd?: boolean
    customerId?: string
    subscriptionId?: string
  }>('getSubscriptionInfo', {})

export const cancelSubscription = () =>
  callApi<{ canceled: boolean; accessUntil?: number }>('cancelSubscription', {})

export const syncPlan = () =>
  callApi<{ plan: string; synced: boolean; customerId?: string; reason?: string }>('syncPlan', {})

export const getProgressFeedback = (data: {
  sessionId: string
  answers: QuizAnswer[]
  quizTitle: string
}) =>
  callApi<{ feedback: string }>(
    'getProgressFeedback',
    data as unknown as Record<string, unknown>
  )

export const generateStudyGuide = (data: {
  text?: string
  deckId?: string
  topicId?: string
  title?: string
}) =>
  callApi<{ id: string; content: StudyGuideContent; title: string }>(
    'generateStudyGuide',
    data as unknown as Record<string, unknown>
  )

export const createCheckout = (data: {
  tier: string
  successUrl: string
  cancelUrl: string
}) =>
  callApi<{ url: string }>('createCheckout', data as unknown as Record<string, unknown>)

export const purchaseCredits = (data: { quantity: number }) =>
  callApi<{ url: string }>('purchaseCredits', data as unknown as Record<string, unknown>)

export const judgeAnswer = (data: {
  question: string
  correctAnswer: string
  userAnswer: string
}) =>
  callApi<{ result: boolean; feedback: string }>(
    'judgeAnswer',
    data as unknown as Record<string, unknown>
  )

export const submitFeedback = (data: {
  uid?: string
  email?: string
  type: string
  message: string
}) => callApi<{ ok: boolean; id: string }>('submitFeedback', data as unknown as Record<string, unknown>)

export async function streamFlashcards(
  data: {
    text: string
    count: number
    title?: string
    existingTitles?: string[]
    existingTopics?: string[]
    answerMode?: 'brief' | 'detailed'
    saveMaterial?: boolean
  },
  onProgress: (cardCount: number, targetCount: number, stepText: string) => void
): Promise<{
  cards: { front: string; back: string }[]
  suggestedTitle: string | null
  suggestedTopicName?: string | null
}> {
  const user = auth.currentUser
  if (!user) throw new Error('Not authenticated')
  const token = await user.getIdToken()

  const res = await fetch(`${BASE}/api/streamFlashcards`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(data),
  })

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '')
    throw Object.assign(new Error(text || `Request failed: ${res.status}`), { status: res.status })
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const events = buffer.split('\n\n')
    buffer = events.pop() ?? ''

    for (const raw of events) {
      if (!raw.startsWith('data: ')) continue
      let event: Record<string, unknown>
      try { event = JSON.parse(raw.slice(6)) } catch { continue }

      if (event.type === 'step') onProgress(0, 0, event.text as string)
      if (event.type === 'progress') {
        const n = event.cardCount as number
        const t = event.targetCount as number
        onProgress(n, t, t > 0 ? `${n} of ${t} cards…` : `${n} cards…`)
      }
      if (event.type === 'error') throw new Error((event.message as string) || 'Generation failed')
      if (event.type === 'done') return event as unknown as { cards: { front: string; back: string }[]; suggestedTitle: string | null; suggestedTopicName?: string | null }
    }
  }
  throw new Error('Stream ended without result')
}

export async function streamQuiz(
  data: {
    deckId?: string
    topicId?: string
    text?: string
    fileData?: string
    mimeType?: string
    count: number
    types: string[]
  },
  onQuestion: (q: QuizQuestion) => void,
  onStep: (text: string) => void,
): Promise<{ deckTitle: string; totalCount: number }> {
  const user = auth.currentUser
  if (!user) throw new Error('Not authenticated')
  const token = await user.getIdToken()

  const res = await fetch(`${BASE}/api/streamQuiz`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(data),
  })

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '')
    throw Object.assign(new Error(text || `Request failed: ${res.status}`), { status: res.status })
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const events = buffer.split('\n\n')
    buffer = events.pop() ?? ''

    for (const raw of events) {
      if (!raw.startsWith('data: ')) continue
      let event: Record<string, unknown>
      try { event = JSON.parse(raw.slice(6)) } catch { continue }

      if (event.type === 'step') onStep(event.text as string)
      if (event.type === 'question') onQuestion(event.question as QuizQuestion)
      if (event.type === 'error') throw new Error((event.message as string) || 'Quiz generation failed')
      if (event.type === 'done') return { deckTitle: event.deckTitle as string, totalCount: event.totalCount as number }
    }
  }
  throw new Error('Stream ended without result')
}
