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
