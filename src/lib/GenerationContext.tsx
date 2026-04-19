import React, { createContext, useCallback, useContext, useState } from 'react'

export interface ActiveGeneration {
  id: string
  title: string
  step: string
  status: 'generating' | 'done' | 'error'
  startedAt: number
  error?: string
  resultDeckId?: string
  resultCardCount?: number
  finalTitle?: string
}

interface GenerationContextValue {
  active: ActiveGeneration | null
  completedAt: number
  startGeneration: (id: string, title: string) => void
  updateStep: (id: string, step: string) => void
  resolveGeneration: (id: string, deckId: string, finalTitle?: string, cardCount?: number) => void
  failGeneration: (id: string, error: string) => void
  dismissGeneration: () => void
}

const GenerationContext = createContext<GenerationContextValue | null>(null)

export function useGeneration() {
  const ctx = useContext(GenerationContext)
  if (!ctx) throw new Error('useGeneration must be inside GenerationProvider')
  return ctx
}

export function GenerationProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState<ActiveGeneration | null>(null)
  const [completedAt, setCompletedAt] = useState<number>(0)

  const startGeneration = useCallback((id: string, title: string) => {
    setActive({ id, title, step: 'Starting…', status: 'generating', startedAt: Date.now() })
  }, [])

  const updateStep = useCallback((id: string, step: string) => {
    setActive(prev => prev?.id === id ? { ...prev, step } : prev)
  }, [])

  const resolveGeneration = useCallback((id: string, deckId: string, finalTitle?: string, cardCount?: number) => {
    setActive(prev =>
      prev?.id === id
        ? { ...prev, status: 'done', resultDeckId: deckId, finalTitle, resultCardCount: cardCount }
        : prev
    )
    setCompletedAt(Date.now())
  }, [])

  const failGeneration = useCallback((id: string, error: string) => {
    setActive(prev => prev?.id === id ? { ...prev, status: 'error', error } : prev)
  }, [])

  const dismissGeneration = useCallback(() => setActive(null), [])

  return (
    <GenerationContext.Provider value={{ active, completedAt, startGeneration, updateStep, resolveGeneration, failGeneration, dismissGeneration }}>
      {children}
    </GenerationContext.Provider>
  )
}
