"use client"

import { Suspense } from "react"
import Hero from "@/components/hero"
import TranscriptionTabs from "@/components/transcription-tabs"
import { ApiConfigProvider } from "@/contexts/api-config-context"

export default function HomePage() {
  return (
    <ApiConfigProvider>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="container mx-auto px-4 py-8">
          <Hero />
          <main className="mt-8">
            <Suspense fallback={<div>Loading...</div>}>
              <TranscriptionTabs />
            </Suspense>
          </main>
        </div>
      </div>
    </ApiConfigProvider>
  )
}
