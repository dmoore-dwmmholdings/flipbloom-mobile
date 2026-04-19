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
  BasicQuiz: {
    cards: { id: string; front: string; back: string; order: number }[]
    deckTitle: string
    deckId?: string
  }
  BasicQuizResults: {
    results: { front: string; back: string; userAnswer: string; correct: boolean }[]
    deckTitle: string
    deckId?: string
    score: number
    total: number
  }
}

export type TabParamList = {
  Library: undefined
  Generate: undefined
  Progress: undefined
  Guides: undefined
  Account: undefined
}
