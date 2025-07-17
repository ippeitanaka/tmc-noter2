"use client"

import { createContext, useContext, useState, ReactNode } from 'react'

type AiProvider = 'gemini' | 'openai' | 'deepseek'

interface AiConfig {
  provider: AiProvider
  // APIキーは環境変数から取得するため、クライアントサイドでは不要
}

interface AiConfigContextType {
  aiConfig: AiConfig
  setAiConfig: (config: AiConfig) => void
}

const AiConfigContext = createContext<AiConfigContextType | undefined>(undefined)

export function AiConfigProvider({ children }: { children: ReactNode }) {
  const [aiConfig, setAiConfig] = useState<AiConfig>({
    provider: 'gemini' // デフォルトでGemini
  })

  return (
    <AiConfigContext.Provider value={{ aiConfig, setAiConfig }}>
      {children}
    </AiConfigContext.Provider>
  )
}

export function useAiConfig() {
  const context = useContext(AiConfigContext)
  if (context === undefined) {
    throw new Error('useAiConfig must be used within an AiConfigProvider')
  }
  return context
}
