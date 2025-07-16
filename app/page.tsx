import { Suspense } from "react"
import { Hero } from "@/components/hero"
import { TranscriptionTabs } from "@/components/transcription-tabs"
import { Footer } from "@/components/footer"

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <main className="container mx-auto px-4 py-8">
        <Hero />
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          }
        >
          <TranscriptionTabs />
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}
