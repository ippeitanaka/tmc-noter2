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
import { useRecording } from "@/contexts/recording-context"

export default function Home() {
  const { transcript: recordingTranscript, audioBlob } = useRecording()
  const [uploadTranscript, setUploadTranscript] = useState("")
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null)
  const [speakerSegments, setSpeakerSegments] = useState<SpeakerSegment[]>([])
  const [speakerProfiles, setSpeakerProfiles] = useState<SpeakerProfile[]>([])
  const [summary, setSummary] = useState<SummaryResult | null>(null)
  const [generatedTemplate, setGeneratedTemplate] = useState<FilledTemplate | null>(null)

  // 現在のアクティブな文字起こしを取得
  const currentTranscript = recordingTranscript || uploadTranscript

  const handleTranscriptionComplete = (result: any) => {
    if (typeof result === 'string') {
      setUploadTranscript(result)
    } else {
      setUploadTranscript(result.transcript)
    }
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

  const handleRealtimeRecording = (recordingBlob: Blob) => {
    // リアルタイム録音完了時の処理
    console.log('Recording completed:', recordingBlob)
    
    // 音声データをAudioBufferに変換して話者識別で使用
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    const reader = new FileReader()
    
    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
        setAudioBuffer(audioBuffer)
        
        // 話者識別を自動実行
        // TODO: 自動的に話者識別を実行する処理を追加
        
      } catch (error) {
        console.error('Failed to process audio:', error)
      }
    }
    
    reader.readAsArrayBuffer(recordingBlob)
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
            {currentTranscript && (
              <TranscriptDisplay 
                transcript={currentTranscript}
              />
            )}
          </TabsContent>

          <TabsContent value="recording" className="space-y-6">
            <RealtimeRecording 
              onRecordingComplete={handleRealtimeRecording}
            />
            {recordingTranscript && (
              <TranscriptDisplay 
                transcript={recordingTranscript}
              />
            )}
          </TabsContent>

          <TabsContent value="speakers" className="space-y-6">
            <SpeakerIdentification
              audioBuffer={audioBuffer}
              transcript={currentTranscript}
              onSpeakerSegments={handleSpeakerSegments}
              onSpeakerProfiles={handleSpeakerProfiles}
            />
            {currentTranscript && speakerSegments.length > 0 && (
              <TranscriptDisplay 
                transcript={currentTranscript}
                speakerSegments={speakerSegments}
                speakerProfiles={speakerProfiles}
              />
            )}
          </TabsContent>

          <TabsContent value="summary" className="space-y-6">
            <SummaryUI
              transcript={currentTranscript}
              onSummaryComplete={handleSummaryComplete}
            />
          </TabsContent>

          <TabsContent value="template" className="space-y-6">
            <TemplateUI
              transcript={currentTranscript}
              summary={summary}
              onTemplateGenerated={handleTemplateGenerated}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
