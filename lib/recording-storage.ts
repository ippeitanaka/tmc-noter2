// リアルタイム録音データの保存・管理
export interface RecordingData {
  id: string
  name: string
  audioBlob: Blob
  transcript: string
  speakerSegments?: any[]
  createdAt: Date
  duration: number
  fileSize: number
}

export interface RecordingMetadata {
  id: string
  name: string
  createdAt: Date
  duration: number
  fileSize: number
}

export class RecordingStorage {
  private static readonly STORAGE_KEY = 'tmc-noter-recordings'
  private static readonly METADATA_KEY = 'tmc-noter-recording-metadata'

  // 録音データをIndexedDBに保存
  static async saveRecording(recording: RecordingData): Promise<void> {
    try {
      // IndexedDBを使用してBlobデータを保存
      const db = await this.openDatabase()
      const transaction = db.transaction(['recordings'], 'readwrite')
      const store = transaction.objectStore('recordings')
      
      return new Promise<void>((resolve, reject) => {
        const request = store.put(recording)
        request.onsuccess = () => {
          resolve()
        }
        request.onerror = () => {
          reject(request.error)
        }
      }).then(() => {
        // メタデータをLocalStorageに保存
        const metadata: RecordingMetadata = {
          id: recording.id,
          name: recording.name,
          createdAt: recording.createdAt,
          duration: recording.duration,
          fileSize: recording.fileSize
        }
        
        this.saveMetadata(metadata)
      })
      
    } catch (error) {
      console.error('録音データの保存に失敗:', error)
      throw error
    }
  }

  // 録音データを取得
  static async getRecording(id: string): Promise<RecordingData | null> {
    try {
      const db = await this.openDatabase()
      const transaction = db.transaction(['recordings'], 'readonly')
      const store = transaction.objectStore('recordings')
      
      return new Promise((resolve, reject) => {
        const request = store.get(id)
        request.onsuccess = () => {
          resolve(request.result || null)
        }
        request.onerror = () => {
          reject(request.error)
        }
      })
      
    } catch (error) {
      console.error('録音データの取得に失敗:', error)
      return null
    }
  }

  // すべての録音メタデータを取得
  static getRecordingList(): RecordingMetadata[] {
    try {
      const metadataJson = localStorage.getItem(this.METADATA_KEY)
      if (!metadataJson) return []
      
      const metadata = JSON.parse(metadataJson) as RecordingMetadata[]
      return metadata.map(item => ({
        ...item,
        createdAt: new Date(item.createdAt)
      }))
      
    } catch (error) {
      console.error('録音リストの取得に失敗:', error)
      return []
    }
  }

  // 録音を削除
  static async deleteRecording(id: string): Promise<void> {
    try {
      const db = await this.openDatabase()
      const transaction = db.transaction(['recordings'], 'readwrite')
      const store = transaction.objectStore('recordings')
      
      return new Promise<void>((resolve, reject) => {
        const request = store.delete(id)
        request.onsuccess = () => {
          resolve()
        }
        request.onerror = () => {
          reject(request.error)
        }
      }).then(() => {
        // メタデータからも削除
        const metadata = this.getRecordingList()
        const updatedMetadata = metadata.filter(item => item.id !== id)
        localStorage.setItem(this.METADATA_KEY, JSON.stringify(updatedMetadata))
      })
      
    } catch (error) {
      console.error('録音データの削除に失敗:', error)
      throw error
    }
  }

  // IndexedDBデータベースを開く
  private static openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('tmc-noter-recordings', 1)
      
      request.onerror = () => {
        reject(request.error)
      }
      
      request.onsuccess = () => {
        resolve(request.result)
      }
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains('recordings')) {
          db.createObjectStore('recordings', { keyPath: 'id' })
        }
      }
    })
  }

  // メタデータを保存
  private static saveMetadata(metadata: RecordingMetadata): void {
    const existingMetadata = this.getRecordingList()
    const updatedMetadata = existingMetadata.filter(item => item.id !== metadata.id)
    updatedMetadata.push(metadata)
    
    // 日付順にソート
    updatedMetadata.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    
    localStorage.setItem(this.METADATA_KEY, JSON.stringify(updatedMetadata))
  }

  // ストレージ使用量を取得
  static async getStorageUsage(): Promise<{
    usedBytes: number
    totalBytes: number
    percentage: number
  }> {
    try {
      const estimate = await navigator.storage.estimate()
      const usedBytes = estimate.usage || 0
      const totalBytes = estimate.quota || 0
      const percentage = totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0
      
      return {
        usedBytes,
        totalBytes,
        percentage
      }
      
    } catch (error) {
      console.error('ストレージ使用量の取得に失敗:', error)
      return {
        usedBytes: 0,
        totalBytes: 0,
        percentage: 0
      }
    }
  }

  // ストレージをクリア
  static async clearAll(): Promise<void> {
    try {
      const db = await this.openDatabase()
      const transaction = db.transaction(['recordings'], 'readwrite')
      const store = transaction.objectStore('recordings')
      
      return new Promise<void>((resolve, reject) => {
        const request = store.clear()
        request.onsuccess = () => {
          resolve()
        }
        request.onerror = () => {
          reject(request.error)
        }
      }).then(() => {
        localStorage.removeItem(this.METADATA_KEY)
      })
      
    } catch (error) {
      console.error('ストレージのクリアに失敗:', error)
      throw error
    }
  }

  // 録音データのエクスポート
  static async exportRecordings(): Promise<void> {
    return RecordingExporter.exportRecordings()
  }
}

// 録音データのエクスポート/インポート
export class RecordingExporter {
  // BlobをBase64に変換
  static blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }

  // 録音データをJSONファイルとしてエクスポート
  static async exportRecordings(): Promise<void> {
    try {
      const metadata = RecordingStorage.getRecordingList()
      const recordings: any[] = []
      
      for (const meta of metadata) {
        const recording = await RecordingStorage.getRecording(meta.id)
        if (recording) {
          // Blobをbase64に変換
          const base64Audio = await this.blobToBase64(recording.audioBlob)
          recordings.push({
            ...recording,
            audioBlob: base64Audio,
            createdAt: recording.createdAt.toISOString()
          })
        }
      }
      
      const exportData = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        recordings
      }
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json'
      })
      
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `tmc-noter-recordings-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
    } catch (error) {
      console.error('録音データのエクスポートに失敗:', error)
      throw error
    }
  }
}
