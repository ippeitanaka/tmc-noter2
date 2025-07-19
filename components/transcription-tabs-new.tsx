"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FileUploadForm } from "./file-upload-form"
import { RealtimeTranscription } from "./realtime-transcription"
import { TranscriptionResults } from "./transcription-results"
import { Upload, Radio, Users, FileText, Hash, Heart } from "lucide-react"

interface TranscriptionData {
  transcript: string
  speakers?: string
  summary?: string
  keywords?: string
  sentiment?: string
  structured?: string
  originalTranscript?: string
  duration?: number
  fileName?: string
  fileSize?: number
  timestamp?: string
}

export function TranscriptionTabs() {
  const [activeTab, setActiveTab] = useState("upload")
  const [transcriptionData, setTranscriptionData] = useState<TranscriptionData | null>(null)

  const handleTranscriptionResult = (data: any) => {
    console.log("📨 Received transcription result:", data)
    
    // データを整理してセット
    const transcriptionResult: TranscriptionData = {
      transcript: data.transcript || "",
      speakers: data.speakers || null,
      summary: data.summary || null,
      keywords: data.keywords || null,
      sentiment: data.sentiment || null,
      structured: data.structured || null,
      originalTranscript: data.originalTranscript || null,
      duration: data.duration || null,
      fileName: data.fileName || null,
      fileSize: data.fileSize || null,
      timestamp: new Date().toISOString()
    }
    
    setTranscriptionData(transcriptionResult)
    console.log("💾 Transcription data saved:", transcriptionResult)
  }

  return (
    <div className="w-full max-w-5xl mx-auto">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-7 mb-8">
          <TabsTrigger value="upload" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            ファイルアップロード
          </TabsTrigger>
          <TabsTrigger value="transcript" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            文字起こし
          </TabsTrigger>
          <TabsTrigger value="speakers" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            話者識別
          </TabsTrigger>
          <TabsTrigger value="summary" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            AI要約
          </TabsTrigger>
          <TabsTrigger value="keywords" className="flex items-center gap-2">
            <Hash className="h-4 w-4" />
            キーワード
          </TabsTrigger>
          <TabsTrigger value="sentiment" className="flex items-center gap-2">
            <Heart className="h-4 w-4" />
            感情分析
          </TabsTrigger>
          <TabsTrigger value="realtime" className="flex items-center gap-2">
            <Radio className="h-4 w-4" />
            リアルタイム
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-6">
          <Card className="backdrop-blur-sm bg-white/10 border-white/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                音声ファイルをアップロード
              </CardTitle>
              <CardDescription>音声ファイルをアップロードして文字起こしと議事録を生成します</CardDescription>
            </CardHeader>
            <CardContent>
              <FileUploadForm onTranscriptionComplete={handleTranscriptionResult} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transcript" className="space-y-6">
          <TranscriptionResults data={transcriptionData} activeSection="transcript" />
        </TabsContent>

        <TabsContent value="speakers" className="space-y-6">
          <TranscriptionResults data={transcriptionData} activeSection="speakers" />
        </TabsContent>

        <TabsContent value="summary" className="space-y-6">
          <TranscriptionResults data={transcriptionData} activeSection="summary" />
        </TabsContent>

        <TabsContent value="keywords" className="space-y-6">
          <TranscriptionResults data={transcriptionData} activeSection="keywords" />
        </TabsContent>

        <TabsContent value="sentiment" className="space-y-6">
          <TranscriptionResults data={transcriptionData} activeSection="sentiment" />
        </TabsContent>

        <TabsContent value="realtime" className="space-y-6">
          <Card className="backdrop-blur-sm bg-white/10 border-white/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Radio className="h-5 w-5" />
                リアルタイム文字起こし
              </CardTitle>
              <CardDescription>マイクを使ってリアルタイムで音声を文字起こしします</CardDescription>
            </CardHeader>
            <CardContent>
              <RealtimeTranscription />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default TranscriptionTabs
