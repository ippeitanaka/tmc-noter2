"use client"

import { useState, useEffect } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"

// AIモデルの型定義（OpenAIを削除）
export type AIModel = "gemini" | "deepseek"

interface AIModelSelectorProps {
  value: AIModel
  onChange: (value: AIModel) => void
  disabled?: boolean
}

export function AIModelSelector({ value, onChange, disabled = false }: AIModelSelectorProps) {
  const [geminiAvailable, setGeminiAvailable] = useState<boolean>(true)
  const [geminiTemporary, setGeminiTemporary] = useState<boolean>(false)
  const [deepseekAvailable, setDeepseekAvailable] = useState<boolean>(false) // デフォルトでfalseに設定
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [geminiModelInfo, setGeminiModelInfo] = useState<string>("")

  // 環境変数の状態をチェック
  useEffect(() => {
    async function checkEnvironment() {
      try {
        setIsLoading(true)

        // Gemini APIキーのチェック
        try {
          const geminiResponse = await fetch("/api/check-gemini")
          console.log("Gemini check response status:", geminiResponse.status)
          
          if (geminiResponse.ok) {
            const responseText = await geminiResponse.text()
            console.log("Gemini response text length:", responseText.length)
            
            try {
              const data = JSON.parse(responseText)
              setGeminiAvailable(data.available)
              setGeminiTemporary(data.temporary || false)

              // 使用中のモデル情報を表示
              if (data.modelUsed) {
                const modelName = data.modelUsed.split("/").pop() || data.modelUsed
                setGeminiModelInfo(`使用モデル: ${modelName}`)
              }

              console.log(
                "Gemini API availability:",
                data.available,
                "temporary:",
                data.temporary,
                "skipApiCheck:",
                data.skipApiCheck,
                "modelUsed:",
                data.modelUsed,
              )
            } catch (parseError) {
              console.error("Failed to parse Gemini response JSON:", parseError)
              console.error("Response text:", responseText)
              setGeminiAvailable(false)
            }
          } else {
            const errorText = await geminiResponse.text()
            console.error("Failed to check Gemini API:", geminiResponse.status, errorText)
            setGeminiAvailable(false)
          }
        } catch (fetchError) {
          console.error("Gemini API check fetch error:", fetchError)
          setGeminiAvailable(false)
        }

        // DeepSeek APIキーのチェック
        try {
          const deepseekResponse = await fetch("/api/check-deepseek")
          console.log("DeepSeek check response status:", deepseekResponse.status)
          
          if (deepseekResponse.ok) {
            const responseText = await deepseekResponse.text()
            console.log("DeepSeek response text length:", responseText.length)
            
            try {
              const data = JSON.parse(responseText)
              setDeepseekAvailable(data.available)
              console.log("DeepSeek API availability:", data.available)
            } catch (parseError) {
              console.error("Failed to parse DeepSeek response JSON:", parseError)
              console.error("Response text:", responseText)
              setDeepseekAvailable(false)
            }
          } else {
            const errorText = await deepseekResponse.text()
            console.error("Failed to check DeepSeek API:", deepseekResponse.status, errorText)
            setDeepseekAvailable(false)
          }
        } catch (fetchError) {
          console.error("DeepSeek API check fetch error:", fetchError)
          setDeepseekAvailable(false)
        }

        // モデル選択のロジックを改善
        if (value === "gemini" && !geminiAvailable) {
          // Geminiが選択されているが利用できない場合
          if (deepseekAvailable) {
            console.log("Gemini is not available, switching to DeepSeek")
            onChange("deepseek")
          } else {
            console.log("Both Gemini and DeepSeek are unavailable, staying with Gemini for rule-based fallback")
            // どちらも使えない場合はGeminiのままにして、ルールベースにフォールバックさせる
          }
        } else if (value === "deepseek" && !deepseekAvailable) {
          // DeepSeekが選択されているが利用できない場合
          console.log("DeepSeek is not available, switching to Gemini")
          onChange("gemini") // Geminiが利用できなくてもルールベースにフォールバックするため
        }
      } catch (error) {
        console.error("環境変数チェックエラー:", error)
        // エラーが発生した場合、Geminiをデフォルトとして使用
        setGeminiAvailable(true)
        setDeepseekAvailable(false)
        if (value === "deepseek") {
          onChange("gemini")
        }
      } finally {
        setIsLoading(false)
      }
    }

    checkEnvironment()
  }, [value, onChange])

  return (
    <div className="space-y-2">
      <Label htmlFor="ai-model">AI モデル</Label>
      <Select value={value} onValueChange={(val) => onChange(val as AIModel)} disabled={disabled || isLoading}>
        <SelectTrigger id="ai-model" className="w-full">
          <SelectValue placeholder="AIモデルを選択" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="gemini">
            Google Gemini {!geminiAvailable && geminiTemporary && "(一時的に利用不可)"}
            {!geminiAvailable && !geminiTemporary && "(利用不可)"}
          </SelectItem>
          <SelectItem value="deepseek" disabled={!deepseekAvailable}>
            DeepSeek-V3 {!deepseekAvailable && "(利用不可)"}
          </SelectItem>
        </SelectContent>
      </Select>
      {geminiModelInfo && geminiAvailable && value === "gemini" && (
        <p className="text-xs text-blue-500 mt-1">{geminiModelInfo}</p>
      )}
      {!geminiAvailable && value === "gemini" && geminiTemporary && (
        <p className="text-xs text-yellow-500 mt-1">
          Geminiは一時的に利用できません。ルールベースの生成が使用されます。
        </p>
      )}
      {!geminiAvailable && value === "gemini" && !geminiTemporary && (
        <p className="text-xs text-red-500 mt-1">Geminiは利用できません。ルールベースの生成が使用されます。</p>
      )}
      {!deepseekAvailable && value === "deepseek" && (
        <p className="text-xs text-red-500 mt-1">DeepSeek-V3は現在利用できません。Geminiが代わりに使用されます。</p>
      )}
    </div>
  )
}

export default AIModelSelector
