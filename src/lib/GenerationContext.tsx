import React, { createContext, useCallback, useContext, useRef, useState } from 'react'

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
  liveCardCount?: number
  liveTargetCount?: number
  retryFn?: () => void
}

interface GenerationContextValue {
  active: ActiveGeneration | null
  completedAt: number
  startGeneration: (id: string, title: string) => void
  updateStep: (id: string, step: string) => void
  updateCount: (id: string, liveCardCount: number, liveTargetCount: number) => void
  resolveGeneration: (id: string, deckId: string, finalTitle?: string, cardCount?: number) => void
  failGeneration: (id: string, error: string) => void
  dismissGeneration: () => void
  setRetryFn: (id: string, fn: () => void) => void
  retryGeneration: () => void
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
  // Keep retryFn in a ref so it doesn't cause re-renders
  const retryFnRef = useRef<(() => void) | null>(null)

  const startGeneration = useCallback((id: string, title: string) => {
    retryFnRef.current = null
    setActive({ id, title, step: 'Starting…', status: 'generating', startedAt: Date.now() })
  }, [])

  const updateStep = useCallback((id: string, step: string) => {
    setActive(prev => prev?.id === id ? { ...prev, step } : prev)
  }, [])

  const updateCount = useCallback((id: string, liveCardCount: number, liveTargetCount: number) => {
    setActive(prev => prev?.id === id ? { ...prev, liveCardCount, liveTargetCount } : prev)
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

  const dismissGeneration = useCallback(() => {
    retryFnRef.current = null
    setActive(null)
  }, [])

  const setRetryFn = useCallback((id: string, fn: () => void) => {
    setActive(prev => {
      if (prev?.id === id) {
        retryFnRef.current = fn
        return { ...prev, retryFn: fn }
      }
      return prev
    })
  }, [])

  const retryGeneration = useCallback(() => {
    const fn = retryFnRef.current
    if (!fn) return
    setActive(prev => prev ? { ...prev, status: 'generating', step: 'Retrying…', error: undefined, liveCardCount: undefined, liveTargetCount: undefined } : null)
    fn()
  }, [])

  return (
    <GenerationContext.Provider value={{
      active,
      completedAt,
      startGeneration,
      updateStep,
      updateCount,
      resolveGeneration,
      failGeneration,
      dismissGeneration,
      setRetryFn,
      retryGeneration,
    }}>
      {children}
    </GenerationContext.Provider>
  )
}
