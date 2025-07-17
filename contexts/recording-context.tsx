// グローバル録音状態管理
"use client"

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { RealtimeRecorder, RecordingState, RecordingChunk } from '@/lib/realtime-recorder'

interface RecordingContextType {
  // 録音状態
  recorder: RealtimeRecorder | null
  recordingState: RecordingState
  chunks: RecordingChunk[]
  transcript: string
  isRecording: boolean
  
  // 録音制御
  startRecording: (config?: any) => Promise<boolean>
  stopRecording: () => Promise<void>
  pauseRecording: () => void
  resumeRecording: () => void
  
  // データ管理
  saveRecording: (name?: string) => Promise<void>
  clearRecording: () => void
  
  // 文字起こし
  updateTranscript: (text: string) => void
  
  // 音声データ
  audioBlob: Blob | null
  setAudioBlob: (blob: Blob | null) => void
}

const RecordingContext = createContext<RecordingContextType | undefined>(undefined)

export const useRecording = () => {
  const context = useContext(RecordingContext)
  if (!context) {
    throw new Error('useRecording must be used within a RecordingProvider')
  }
  return context
}

interface RecordingProviderProps {
  children: ReactNode
}

export const RecordingProvider: React.FC<RecordingProviderProps> = ({ children }) => {
  const [recorder, setRecorder] = useState<RealtimeRecorder | null>(null)
  const [recordingState, setRecordingState] = useState<RecordingState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    currentChunk: 0,
    totalChunks: 0,
    audioLevel: 0
  })
  const [chunks, setChunks] = useState<RecordingChunk[]>([])
  const [transcript, setTranscript] = useState("")
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)

  // localStorage からデータを復元
  useEffect(() => {
    const savedTranscript = localStorage.getItem('recording-transcript')
    const savedChunks = localStorage.getItem('recording-chunks')
    
    if (savedTranscript) {
      setTranscript(savedTranscript)
    }
    
    if (savedChunks) {
      try {
        setChunks(JSON.parse(savedChunks))
      } catch (error) {
        console.error('Failed to parse saved chunks:', error)
      }
    }
  }, [])

  // データの永続化
  useEffect(() => {
    if (transcript) {
      localStorage.setItem('recording-transcript', transcript)
    }
  }, [transcript])

  useEffect(() => {
    if (chunks.length > 0) {
      // チャンクデータは大きすぎるので保存しない
      // localStorage.setItem('recording-chunks', JSON.stringify(chunks))
    }
  }, [chunks])

  const startRecording = async (config?: any) => {
    try {
      const newRecorder = new RealtimeRecorder(config)
      
      newRecorder.setEventListeners({
        onStateChange: (state) => {
          setRecordingState(state)
        },
        onChunkComplete: (chunk) => {
          setChunks(prev => [...prev, chunk])
          if (chunk.transcription) {
            setTranscript(prev => prev + (prev ? '\n' : '') + chunk.transcription)
          }
        },
        onError: (error) => {
          console.error('Recording error:', error)
        }
      })

      const success = await newRecorder.startRecording()
      if (success) {
        setRecorder(newRecorder)
        setChunks([])
        setTranscript("")
        setAudioBlob(null)
        return true
      }
      return false
    } catch (error) {
      console.error('Failed to start recording:', error)
      return false
    }
  }

  const stopRecording = async () => {
    if (recorder) {
      await recorder.stopRecording()
      
      // 録音データを結合
      if (chunks.length > 0) {
        try {
          const combinedBlob = await recorder.combineChunks()
          setAudioBlob(combinedBlob)
        } catch (error) {
          console.error('Failed to combine chunks:', error)
        }
      }
    }
  }

  const pauseRecording = () => {
    if (recorder) {
      recorder.pauseRecording()
    }
  }

  const resumeRecording = () => {
    if (recorder) {
      recorder.resumeRecording()
    }
  }

  const saveRecording = async (name?: string) => {
    if (recorder) {
      await recorder.saveRecording(name)
    }
  }

  const clearRecording = () => {
    setChunks([])
    setTranscript("")
    setAudioBlob(null)
    localStorage.removeItem('recording-transcript')
    localStorage.removeItem('recording-chunks')
    
    if (recorder) {
      recorder.clearRecording()
    }
  }

  const updateTranscript = (text: string) => {
    setTranscript(text)
  }

  const value: RecordingContextType = {
    recorder,
    recordingState,
    chunks,
    transcript,
    isRecording: recordingState.isRecording,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    saveRecording,
    clearRecording,
    updateTranscript,
    audioBlob,
    setAudioBlob
  }

  return (
    <RecordingContext.Provider value={value}>
      {children}
    </RecordingContext.Provider>
  )
}
