"use client"

import { createContext, useContext, useState, ReactNode } from 'react'

type ApiProvider = 'openai' | 'assemblyai' | 'azure' | 'webspeech' | 'offline'

interface ApiConfig {
  provider: ApiProvider
  apiKey?: string
  region?: string
}

interface ApiConfigContextType {
  apiConfig: ApiConfig
  setApiConfig: (config: ApiConfig) => void
}

const ApiConfigContext = createContext<ApiConfigContextType | undefined>(undefined)

export function ApiConfigProvider({ children }: { children: ReactNode }) {
  const [apiConfig, setApiConfig] = useState<ApiConfig>({
    provider: 'webspeech' // デフォルトでWeb Speech API
  })

  return (
    <ApiConfigContext.Provider value={{ apiConfig, setApiConfig }}>
      {children}
    </ApiConfigContext.Provider>
  )
}

export function useApiConfig() {
  const context = useContext(ApiConfigContext)
  if (context === undefined) {
    throw new Error('useApiConfig must be used within an ApiConfigProvider')
  }
  return context
}
