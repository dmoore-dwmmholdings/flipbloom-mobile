import type { QuizQuestion, QuizAnswer } from '../lib/types'

export type RootStackParamList = {
  Login: undefined
  Main: undefined
  Deck: { deckId: string }
  Study: { deckId: string; deckTitle: string }
  QuizSetup: { deckId?: string; deckTitle?: string }
  QuizSession: { questions: QuizQuestion[]; quizId?: string; quizTitle: string }
  QuizResults: {
    sessionId: string
    quizId: string
    quizTitle: string
    score: number
    total: number
    answers: QuizAnswer[]
  }
  StudyComplete: {
    deckId: string
    deckTitle: string
    knownCount: number
    unknownCount: number
    totalCards: number
  }
  StudySessionDetail: { sessionId: string }
  Pricing: undefined
  StudyGuideView: { guideId: string }
}

export type TabParamList = {
  Library: undefined
  Generate: undefined
  Progress: undefined
  Guides: undefined
  Account: undefined
}
