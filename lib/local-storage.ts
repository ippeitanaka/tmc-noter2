// ローカルストレージを使用した記録管理

export interface AudioRecord {
  id: string
  fileName: string
  transcript: string
  minutes: any
  createdAt: string
}

const STORAGE_KEY = "tmc-noter-records"

export function saveRecord(record: AudioRecord): void {
  try {
    const records = getRecords()
    const existingIndex = records.findIndex((r) => r.id === record.id)

    if (existingIndex >= 0) {
      records[existingIndex] = record
    } else {
      records.unshift(record)
    }

    // 最大100件まで保存
    const limitedRecords = records.slice(0, 100)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(limitedRecords))
  } catch (error) {
    console.error("Failed to save record:", error)
  }
}

export function getRecords(): AudioRecord[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch (error) {
    console.error("Failed to get records:", error)
    return []
  }
}

export function getRecord(id: string): AudioRecord | null {
  try {
    const records = getRecords()
    return records.find((r) => r.id === id) || null
  } catch (error) {
    console.error("Failed to get record:", error)
    return null
  }
}

export function deleteRecord(id: string): void {
  try {
    const records = getRecords()
    const filteredRecords = records.filter((r) => r.id !== id)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredRecords))
  } catch (error) {
    console.error("Failed to delete record:", error)
  }
}

export function clearAllRecords(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (error) {
    console.error("Failed to clear records:", error)
  }
}
