import { Suspense } from "react"
"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Hero from "@/components/hero"
import FileUploadForm from "@/components/file-upload-form"
import TranscriptDisplay from "@/components/transcript-display"
import SpeakerIdentification from "@/components/speaker-identification"
import SummaryUI from "@/components/summary-ui"
import TemplateUI from "@/components/template-ui"
import RealtimeRecording from "@/components/realtime-recording"
import { SpeakerProfile, SpeakerSegment } from "@/lib/speaker-identification"
import { SummaryResult } from "@/lib/rule-based-summarizer"
import { FilledTemplate } from "@/lib/meeting-templates"
import { TranscriptionTabs } from "@/components/transcription-tabs"
import { Footer } from "@/components/footer"

export default function Home() {
  const [transcript, setTranscript] = useState("")
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null)
  const [speakerSegments, setSpeakerSegments] = useState<SpeakerSegment[]>([])
  const [speakerProfiles, setSpeakerProfiles] = useState<SpeakerProfile[]>([])
  const [summary, setSummary] = useState<SummaryResult | null>(null)
  const [generatedTemplate, setGeneratedTemplate] = useState<FilledTemplate | null>(null)

  const handleTranscriptionComplete = (transcriptText: string) => {
    setTranscript(transcriptText)
  }

  const handleAudioProcessed = (buffer: AudioBuffer) => {
    setAudioBuffer(buffer)
  }

  const handleSpeakerSegments = (segments: SpeakerSegment[]) => {
    setSpeakerSegments(segments)
  }

  const handleSpeakerProfiles = (profiles: SpeakerProfile[]) => {
    setSpeakerProfiles(profiles)
  }

  const handleSummaryComplete = (summaryResult: SummaryResult) => {
    setSummary(summaryResult)
  }

  const handleTemplateGenerated = (template: FilledTemplate) => {
    setGeneratedTemplate(template)
  }

  const handleRealtimeRecording = (audioBlob: Blob) => {
    // リアルタイム録音完了時の処理
    // 音声ファイルを自動的にアップロード処理に渡す
    const file = new File([audioBlob], `recording_${Date.now()}.webm`, { type: 'audio/webm' })
    // FileUploadFormの処理を呼び出す（実装は後で調整）
    console.log('Recording completed:', file)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <Hero />
        
        <Tabs defaultValue="upload" className="mt-8">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="upload">音声アップロード</TabsTrigger>
            <TabsTrigger value="recording">リアルタイム録音</TabsTrigger>
            <TabsTrigger value="speakers">話者識別</TabsTrigger>
            <TabsTrigger value="summary">AI要約</TabsTrigger>
            <TabsTrigger value="template">議事録テンプレート</TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-6">
            <FileUploadForm 
              onTranscriptionComplete={handleTranscriptionComplete}
              onAudioProcessed={handleAudioProcessed}
            />
            {transcript && (
              <TranscriptDisplay 
                transcript={transcript}
              />
            )}
          </TabsContent>

          <TabsContent value="recording" className="space-y-6">
            <RealtimeRecording 
              onRecordingComplete={handleRealtimeRecording}
            />
          </TabsContent>

          <TabsContent value="speakers" className="space-y-6">
            <SpeakerIdentification
              audioBuffer={audioBuffer}
              transcript={transcript}
              onSpeakerSegments={handleSpeakerSegments}
              onSpeakerProfiles={handleSpeakerProfiles}
            />
            {transcript && speakerSegments.length > 0 && (
              <TranscriptDisplay 
                transcript={transcript}
                speakerSegments={speakerSegments}
                speakerProfiles={speakerProfiles}
              />
            )}
          </TabsContent>

          <TabsContent value="summary" className="space-y-6">
            <SummaryUI
              transcript={transcript}
              onSummaryComplete={handleSummaryComplete}
            />
          </TabsContent>

          <TabsContent value="template" className="space-y-6">
            <TemplateUI
              transcript={transcript}
              summary={summary}
              onTemplateGenerated={handleTemplateGenerated}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
