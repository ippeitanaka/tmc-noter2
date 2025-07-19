"use client"

import { useState, useEffect } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"

// AIモデルの型定義（Geminiを最優先）
export type AIModel = "gemini" | "deepseek" | "openai"

interface AIModelSelectorProps {
  value: AIModel
  onChange: (value: AIModel) => void
  disabled?: boolean
}

export function AIModelSelector({ value, onChange, disabled = false }: AIModelSelectorProps) {
  const [geminiAvailable, setGeminiAvailable] = useState<boolean>(true)
  const [geminiTemporary, setGeminiTemporary] = useState<boolean>(false)
  const [deepseekAvailable, setDeepseekAvailable] = useState<boolean>(false)
  const [openaiAvailable, setOpenaiAvailable] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [geminiModelInfo, setGeminiModelInfo] = useState<string>("デフォルト・推奨")

  // 環境変数の状態をチェック
  useEffect(() => {
    async function checkEnvironment() {
      try {
        setIsLoading(true)

        // Gemini APIキーのチェック（最優先）
        try {
          const geminiResponse = await fetch("/api/check-gemini")
          console.log("🔍 Gemini check response status:", geminiResponse.status)
          
          if (geminiResponse.ok) {
            const responseText = await geminiResponse.text()
            if (responseText && responseText.trim() !== '') {
              try {
                const data = JSON.parse(responseText)
                setGeminiAvailable(data.available)
                setGeminiTemporary(data.temporary || false)
                
                if (data.modelUsed) {
                  const modelName = data.modelUsed.split("/").pop() || data.modelUsed
                  setGeminiModelInfo(`${modelName} (推奨・無料)`)
                } else {
                  setGeminiModelInfo("高品質議事録生成 (推奨・無料)")
                }
                
                console.log("✅ Gemini API availability:", data.available)
              } catch (parseError) {
                console.error("❌ Failed to parse Gemini response:", parseError)
                setGeminiAvailable(false)
              }
            } else {
              console.warn("⚠️ Empty Gemini response")
              setGeminiAvailable(false)
            }
          } else {
            console.warn("⚠️ Gemini API check failed:", geminiResponse.status)
            setGeminiAvailable(false)
          }
        } catch (fetchError) {
          console.error("❌ Gemini API check error:", fetchError)
          setGeminiAvailable(false)
        }

        // OpenAI APIキーのチェック
        try {
          const openaiResponse = await fetch("/api/check-openai")
          if (openaiResponse.ok) {
            const data = await openaiResponse.json()
            setOpenaiAvailable(data.available)
            console.log("🔍 OpenAI API availability:", data.available)
          } else {
            setOpenaiAvailable(false)
          }
        } catch (fetchError) {
          console.error("❌ OpenAI API check error:", fetchError)
          setOpenaiAvailable(false)
        }

        // DeepSeek APIキーのチェック
        try {
          const deepseekResponse = await fetch("/api/check-deepseek")
          if (deepseekResponse.ok) {
            const data = await deepseekResponse.json()
            setDeepseekAvailable(data.available)
            console.log("🔍 DeepSeek API availability:", data.available)
          } else {
            setDeepseekAvailable(false)
          }
        } catch (fetchError) {
          console.error("❌ DeepSeek API check error:", fetchError)
          setDeepseekAvailable(false)
        }

        // スマートなモデル選択ロジック（Geminiを最優先）
        if (!geminiAvailable && !deepseekAvailable && !openaiAvailable) {
          // 全て利用不可の場合はGeminiにして、ルールベースにフォールバック
          console.log("🔄 全てのAIプロバイダーが利用不可、Geminiのルールベースフォールバックを使用")
          if (value !== "gemini") {
            onChange("gemini")
          }
        } else if (value === "deepseek" && !deepseekAvailable) {
          // DeepSeekが選択されているが利用できない場合、Geminiに切り替え
          console.log("🔄 DeepSeek利用不可、Geminiに切り替え")
          onChange("gemini")
        } else if (value === "openai" && !openaiAvailable) {
          // OpenAIが選択されているが利用できない場合、Geminiに切り替え
          console.log("🔄 OpenAI利用不可、Geminiに切り替え")
          onChange("gemini")
        }
      } catch (error) {
        console.error("❌ 環境変数チェックエラー:", error)
        // エラー時はGeminiをデフォルトに設定
        setGeminiAvailable(true)
        setDeepseekAvailable(false)
        setOpenaiAvailable(false)
        if (value !== "gemini") {
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
      <Label htmlFor="ai-model" className="text-sm font-semibold">AI モデル（高品質議事録生成）</Label>
      <Select value={value} onValueChange={(val) => onChange(val as AIModel)} disabled={disabled || isLoading}>
        <SelectTrigger id="ai-model" className="w-full">
          <SelectValue placeholder="AIモデルを選択" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="gemini" className="font-bold">
            <div className="flex items-center space-x-2">
              <span className="text-lg">🌟</span>
              <span>Google Gemini</span>
              <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                {geminiAvailable ? "推奨・無料" : !geminiTemporary ? "利用不可" : "一時的に利用不可"}
              </span>
            </div>
          </SelectItem>
          <SelectItem value="deepseek" disabled={!deepseekAvailable}>
            <div className="flex items-center space-x-2">
              <span className="text-lg">🚀</span>
              <span>DeepSeek-V3</span>
              <span className={`text-xs px-2 py-1 rounded-full ${deepseekAvailable ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-500'}`}>
                {deepseekAvailable ? "無料" : "利用不可"}
              </span>
            </div>
          </SelectItem>
          <SelectItem value="openai" disabled={!openaiAvailable}>
            <div className="flex items-center space-x-2">
              <span className="text-lg">🤖</span>
              <span>OpenAI GPT</span>
              <span className={`text-xs px-2 py-1 rounded-full ${openaiAvailable ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-500'}`}>
                {openaiAvailable ? "有料・高精度" : "利用不可"}
              </span>
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
      
      {/* 状態表示 */}
      {value === "gemini" && (
        <div className="mt-2">
          {geminiAvailable ? (
            <p className="text-xs text-green-600 mt-1 font-medium bg-green-50 p-2 rounded border border-green-200">
              ✅ {geminiModelInfo} - プロフェッショナルな議事録を生成します
            </p>
          ) : geminiTemporary ? (
            <p className="text-xs text-yellow-600 mt-1 bg-yellow-50 p-2 rounded border border-yellow-200">
              ⚠️ Geminiは一時的に利用できません。ルールベース生成を使用します。
            </p>
          ) : (
            <p className="text-xs text-red-600 mt-1 bg-red-50 p-2 rounded border border-red-200">
              ❌ Geminiは利用できません。ルールベース生成を使用します。
            </p>
          )}
        </div>
      )}
      
      {value === "deepseek" && deepseekAvailable && (
        <p className="text-xs text-blue-600 mt-1 bg-blue-50 p-2 rounded border border-blue-200">
          ✅ DeepSeek-V3が利用可能です（無料・高品質）
        </p>
      )}
      
      {value === "openai" && openaiAvailable && (
        <p className="text-xs text-purple-600 mt-1 bg-purple-50 p-2 rounded border border-purple-200">
          ✅ OpenAI GPTが利用可能です（有料・最高精度）
        </p>
      )}
      
      {/* 品質比較情報 */}
      <div className="text-xs text-gray-500 mt-2 bg-gray-50 p-2 rounded border border-gray-200">
        <div className="font-medium mb-1">🎯 議事録品質ランキング:</div>
        <div>1. 🌟 Gemini (推奨) - 無料・高品質・構造化</div>
        <div>2. 🚀 DeepSeek-V3 - 無料・高速</div>
        <div>3. 🤖 OpenAI GPT - 有料・最高精度</div>
      </div>
    </div>
  )
}

export default AIModelSelector
