export const FREE_DECK_LIMIT = 3
export const FREE_CARD_LIMIT = 20
export const PRO_DECK_LIMIT = 15
export const MAX_DECK_LIMIT = 50
export const PRO_GUIDE_LIMIT = 1
export const MAX_GUIDE_LIMIT = 5

export interface UserProfile {
  uid: string
  email: string
  plan: 'free' | 'pro' | 'max'
  credits: number
  deckCount: number
  aiJudgments?: number
  aiJudgmentsResetAt?: unknown
  stripeCustomerId?: string
  stripeSubscriptionId?: string
  createdAt?: unknown
}

export interface Deck {
  id: string
  uid: string
  title: string
  description?: string
  cardCount: number
  topicId?: string | null
  topicName?: string | null
  createdAt: unknown
}

export interface FlashCard {
  id: string
  deckId: string
  front: string
  back: string
  order: number
}

/** Alias used in quiz screens where deckId context is implicit */
export type Card = FlashCard

export interface Topic {
  id: string
  uid: string
  name: string
  color: string
  createdAt?: unknown
}

export interface StudySession {
  id: string
  uid: string
  deckId: string
  deckTitle: string
  topicId?: string | null
  topicName?: string | null
  knownCount: number
  unknownCount: number
  totalCards: number
  duration?: number
  cardResults?: Array<{ cardId: string; front: string; back: string; known: boolean }>
  createdAt: unknown
}

export interface SavedQuiz {
  id: string
  uid: string
  title: string
  source: 'deck' | 'text' | 'file'
  deckId?: string | null
  topicId?: string | null
  topicName?: string | null
  questions: QuizQuestion[]
  createdAt: unknown
  attempts: number
  bestScore?: number | null
}

export interface QuizQuestion {
  id: string
  type: 'multiple_choice' | 'true_false' | 'free_form'
  question: string
  options?: string[]
  correct: string
  explanation?: string
}

export interface QuizAnswer {
  questionId: string
  userAnswer: string
  correct: boolean
  overridden?: boolean
  feedback?: string | null
}

export interface QuizSession {
  id: string
  uid: string
  quizId: string
  quizTitle: string
  score: number
  totalQuestions: number
  answers: QuizAnswer[]
  aiFeedback?: string | null
  createdAt: unknown
}

export interface StudyGuideContent {
  title: string
  subtitle?: string
  overview: string
  sections: Array<{
    heading: string
    body: string
    bullets?: string[]
    keyTerms?: Array<{ term: string; definition: string }>
    examples?: string[]
  }>
  keyTakeaways: string[]
  summary: string
}

export interface StudyGuide {
  id: string
  uid: string
  title: string
  topicId?: string | null
  topicName?: string | null
  sourceType: 'text' | 'file' | 'deck' | 'topic'
  content: StudyGuideContent
  createdAt: unknown
}
