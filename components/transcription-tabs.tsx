"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FileUploadForm } from "./file-upload-form"
import { RealtimeTranscription } from "./realtime-transcription"
import { TranscriptionResults } from "./transcription-results"
import { MinutesGenerator } from "./minutes-generator"
import { Upload, Radio, Users, FileText, Hash, Heart, ScrollText, Sparkles } from "lucide-react"

interface TranscriptionData {
  transcript: string
  speakers?: string
  summary?: string
  keywords?: string
  sentiment?: string
  structured?: string
  minutes?: string
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
      minutes: data.minutes || null,
      originalTranscript: data.originalTranscript || null,
      duration: data.duration || null,
      fileName: data.fileName || null,
      fileSize: data.fileSize || null,
      timestamp: new Date().toISOString()
    }
    
    setTranscriptionData(transcriptionResult)
    setTranscriptionData(transcriptionResult)
    console.log("💾 Transcription data saved:", transcriptionResult)
  }

  const handleMinutesGenerated = (minutes: string) => {
    if (transcriptionData) {
      setTranscriptionData({
        ...transcriptionData,
        minutes: minutes
      })
      console.log("📝 Minutes generated and saved:", minutes.substring(0, 100) + "...")
    }
  }

  return (
    <div className="w-full max-w-6xl mx-auto">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        {/* モダンなタブリスト */}
        <div className="mb-8 bg-white/80 backdrop-blur-sm rounded-2xl p-2 shadow-lg border border-white/20">
          <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8 h-auto gap-1 bg-transparent">
            <TabsTrigger 
              value="upload" 
              className="flex flex-col items-center gap-1 p-4 rounded-xl data-[state=active]:bg-gradient-to-br data-[state=active]:from-blue-500 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-200 hover:scale-105"
            >
              <Upload className="h-5 w-5" />
              <span className="text-xs font-medium">アップロード</span>
            </TabsTrigger>
            <TabsTrigger 
              value="transcript" 
              className="flex flex-col items-center gap-1 p-4 rounded-xl data-[state=active]:bg-gradient-to-br data-[state=active]:from-green-500 data-[state=active]:to-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-200 hover:scale-105"
            >
              <FileText className="h-5 w-5" />
              <span className="text-xs font-medium">文字起こし</span>
            </TabsTrigger>
            <TabsTrigger 
              value="speakers" 
              className="flex flex-col items-center gap-1 p-4 rounded-xl data-[state=active]:bg-gradient-to-br data-[state=active]:from-orange-500 data-[state=active]:to-red-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-200 hover:scale-105"
            >
              <Users className="h-5 w-5" />
              <span className="text-xs font-medium">話者識別</span>
            </TabsTrigger>
            <TabsTrigger 
              value="summary" 
              className="flex flex-col items-center gap-1 p-4 rounded-xl data-[state=active]:bg-gradient-to-br data-[state=active]:from-indigo-500 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-200 hover:scale-105"
            >
              <Sparkles className="h-5 w-5" />
              <span className="text-xs font-medium">AI要約</span>
            </TabsTrigger>
            <TabsTrigger 
              value="minutes" 
              className="flex flex-col items-center gap-1 p-4 rounded-xl data-[state=active]:bg-gradient-to-br data-[state=active]:from-purple-500 data-[state=active]:to-pink-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-200 hover:scale-105"
            >
              <ScrollText className="h-5 w-5" />
              <span className="text-xs font-medium">議事録</span>
            </TabsTrigger>
            <TabsTrigger 
              value="keywords" 
              className="flex flex-col items-center gap-1 p-4 rounded-xl data-[state=active]:bg-gradient-to-br data-[state=active]:from-teal-500 data-[state=active]:to-cyan-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-200 hover:scale-105"
            >
              <Hash className="h-5 w-5" />
              <span className="text-xs font-medium">キーワード</span>
            </TabsTrigger>
            <TabsTrigger 
              value="sentiment" 
              className="flex flex-col items-center gap-1 p-4 rounded-xl data-[state=active]:bg-gradient-to-br data-[state=active]:from-pink-500 data-[state=active]:to-rose-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-200 hover:scale-105"
            >
              <Heart className="h-5 w-5" />
              <span className="text-xs font-medium">感情分析</span>
            </TabsTrigger>
            <TabsTrigger 
              value="realtime" 
              className="flex flex-col items-center gap-1 p-4 rounded-xl data-[state=active]:bg-gradient-to-br data-[state=active]:from-red-500 data-[state=active]:to-orange-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-200 hover:scale-105"
            >
              <Radio className="h-5 w-5" />
              <span className="text-xs font-medium">リアルタイム</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="upload" className="space-y-6">
          <Card className="bg-gradient-to-br from-blue-50 to-purple-50 border-2 border-blue-200/50 shadow-xl rounded-2xl overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-blue-500 to-purple-600 text-white">
              <CardTitle className="flex items-center gap-3 text-xl">
                <div className="p-2 bg-white/20 rounded-xl">
                  <Upload className="h-6 w-6" />
                </div>
                音声ファイルをアップロード
              </CardTitle>
              <CardDescription className="text-blue-100">
                🎵 音声ファイルをアップロードして、AIが自動で文字起こしと分析を行います
              </CardDescription>
            </CardHeader>
            <CardContent className="p-8">
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

        <TabsContent value="minutes" className="space-y-6">
          <MinutesGenerator 
            transcript={transcriptionData?.transcript}
            onMinutesGenerated={handleMinutesGenerated}
          />
          {transcriptionData?.minutes && (
            <TranscriptionResults data={transcriptionData} activeSection="minutes" />
          )}
        </TabsContent>

        <TabsContent value="keywords" className="space-y-6">
          <TranscriptionResults data={transcriptionData} activeSection="keywords" />
        </TabsContent>

        <TabsContent value="sentiment" className="space-y-6">
          <TranscriptionResults data={transcriptionData} activeSection="sentiment" />
        </TabsContent>

        <TabsContent value="realtime" className="space-y-6">
          <Card className="bg-gradient-to-br from-red-50 to-orange-50 border-2 border-red-200/50 shadow-xl rounded-2xl overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-red-500 to-orange-600 text-white">
              <CardTitle className="flex items-center gap-3 text-xl">
                <div className="p-2 bg-white/20 rounded-xl">
                  <Radio className="h-6 w-6" />
                </div>
                リアルタイム文字起こし
              </CardTitle>
              <CardDescription className="text-red-100">
                🎤 マイクを使ってリアルタイムで音声を文字起こしします
              </CardDescription>
            </CardHeader>
            <CardContent className="p-8">
              <RealtimeTranscription />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default TranscriptionTabs
