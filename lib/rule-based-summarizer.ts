// ルールベースの要約機能
export interface SummaryResult {
  keyPoints: string[]
  decisions: string[]
  actionItems: string[]
  participants: string[]
  meetingDuration: string
  wordCount: number
  summary: string
}

export interface KeywordScore {
  word: string
  score: number
  frequency: number
  positions: number[]
}

export class RuleBasedSummarizer {
  private readonly importantKeywords = [
    // 決定・合意関連
    '決定', '合意', '承認', '可決', '採択', '結論', '決める', '決まる',
    // アクション関連
    'アクション', '対応', '実施', '実行', '進める', '取り組む', '担当',
    // 重要度関連
    '重要', '重点', '優先', '課題', '問題', 'リスク', '懸念',
    // 時間関連
    '期限', '納期', 'スケジュール', '予定', '計画', '次回',
    // 人物関連
    '担当者', '責任者', '部長', '課長', '主任', 'マネージャー',
    // 数値関連
    '予算', '売上', '利益', '目標', '達成', '結果', '効果'
  ]

  private readonly decisionKeywords = [
    '決定', '合意', '承認', '可決', '採択', '結論', '決める', '決まる',
    '了承', '同意', '賛成', '反対', '却下', '保留', '検討'
  ]

  private readonly actionKeywords = [
    'アクション', '対応', '実施', '実行', '進める', '取り組む', '担当',
    '確認', '調査', '検討', '準備', '作成', '提出', '報告', '連絡'
  ]

  private readonly timeKeywords = [
    '今日', '明日', '来週', '来月', '次回', '期限', '納期', '締切',
    '月末', '年度末', 'までに', 'まで', '時間', '分', '秒'
  ]

  // テキストを文に分割
  private splitIntoSentences(text: string): string[] {
    // 日本語の文区切り文字で分割
    return text
      .split(/[。！？\n]/)
      .map(sentence => sentence.trim())
      .filter(sentence => sentence.length > 0)
  }

  // 単語を抽出（簡易形態素解析）
  private extractWords(text: string): string[] {
    // ひらがな、カタカナ、漢字、英数字を抽出
    const words = text.match(/[ぁ-んァ-ヶ一-龠a-zA-Z0-9]+/g) || []
    return words.filter(word => word.length > 1) // 1文字以下は除外
  }

  // キーワードスコアを計算
  private calculateKeywordScores(text: string): KeywordScore[] {
    const words = this.extractWords(text)
    const wordCount = new Map<string, { frequency: number; positions: number[] }>()
    
    // 単語の出現回数と位置を記録
    words.forEach((word, index) => {
      if (!wordCount.has(word)) {
        wordCount.set(word, { frequency: 0, positions: [] })
      }
      const entry = wordCount.get(word)!
      entry.frequency++
      entry.positions.push(index)
    })

    // スコアを計算
    const scores: KeywordScore[] = []
    for (const [word, data] of wordCount) {
      let score = data.frequency // 基本スコア（出現回数）
      
      // 重要キーワードにボーナス
      if (this.importantKeywords.includes(word)) {
        score *= 3
      }
      
      // 決定キーワードにボーナス
      if (this.decisionKeywords.includes(word)) {
        score *= 2.5
      }
      
      // アクションキーワードにボーナス
      if (this.actionKeywords.includes(word)) {
        score *= 2
      }
      
      // 時間キーワードにボーナス
      if (this.timeKeywords.includes(word)) {
        score *= 1.5
      }
      
      scores.push({
        word,
        score,
        frequency: data.frequency,
        positions: data.positions
      })
    }
    
    return scores.sort((a, b) => b.score - a.score)
  }

  // 重要な文を抽出
  private extractImportantSentences(text: string, topN: number = 5): string[] {
    const sentences = this.splitIntoSentences(text)
    const keywordScores = this.calculateKeywordScores(text)
    const topKeywords = keywordScores.slice(0, 20).map(k => k.word)
    
    // 各文のスコアを計算
    const sentenceScores = sentences.map(sentence => {
      let score = 0
      const words = this.extractWords(sentence)
      
      // キーワードの出現数でスコア計算
      words.forEach(word => {
        if (topKeywords.includes(word)) {
          score += keywordScores.find(k => k.word === word)?.score || 0
        }
      })
      
      // 文の長さでスコア調整（適度な長さの文を優先）
      const length = sentence.length
      if (length > 20 && length < 100) {
        score *= 1.2
      } else if (length > 100) {
        score *= 0.8
      }
      
      return { sentence, score }
    })
    
    // スコア順にソートして上位N件を返す
    return sentenceScores
      .sort((a, b) => b.score - a.score)
      .slice(0, topN)
      .map(item => item.sentence)
  }

  // 決定事項を抽出
  private extractDecisions(text: string): string[] {
    const sentences = this.splitIntoSentences(text)
    const decisions: string[] = []
    
    sentences.forEach(sentence => {
      // 決定キーワードが含まれる文を抽出
      const hasDecisionKeyword = this.decisionKeywords.some(keyword => 
        sentence.includes(keyword)
      )
      
      if (hasDecisionKeyword && sentence.length > 10) {
        decisions.push(sentence)
      }
    })
    
    return decisions
  }

  // アクションアイテムを抽出
  private extractActionItems(text: string): string[] {
    const sentences = this.splitIntoSentences(text)
    const actionItems: string[] = []
    
    sentences.forEach(sentence => {
      // アクションキーワードと時間キーワードが含まれる文を抽出
      const hasActionKeyword = this.actionKeywords.some(keyword => 
        sentence.includes(keyword)
      )
      const hasTimeKeyword = this.timeKeywords.some(keyword => 
        sentence.includes(keyword)
      )
      
      if ((hasActionKeyword || hasTimeKeyword) && sentence.length > 10) {
        actionItems.push(sentence)
      }
    })
    
    return actionItems
  }

  // 参加者を抽出
  private extractParticipants(text: string): string[] {
    const participants: string[] = []
    
    // 敬語や役職を含む表現を検索
    const patterns = [
      /(\w+)部長/g,
      /(\w+)課長/g,
      /(\w+)主任/g,
      /(\w+)マネージャー/g,
      /(\w+)さん/g,
      /(\w+)氏/g,
      /(\w+)様/g
    ]
    
    patterns.forEach(pattern => {
      const matches = text.match(pattern)
      if (matches) {
        matches.forEach(match => {
          const name = match.replace(/(部長|課長|主任|マネージャー|さん|氏|様)/g, '')
          if (name && name.length > 0 && !participants.includes(name)) {
            participants.push(name)
          }
        })
      }
    })
    
    return participants
  }

  // 会議時間を推定
  private estimateMeetingDuration(text: string): string {
    const wordCount = this.extractWords(text).length
    
    // 日本語の平均話速（1分間に約300-400文字）から推定
    const charactersPerMinute = 350
    const totalCharacters = text.length
    const estimatedMinutes = Math.round(totalCharacters / charactersPerMinute)
    
    if (estimatedMinutes < 60) {
      return `約${estimatedMinutes}分`
    } else {
      const hours = Math.floor(estimatedMinutes / 60)
      const minutes = estimatedMinutes % 60
      return `約${hours}時間${minutes}分`
    }
  }

  // 全体の要約を生成
  private generateSummary(keyPoints: string[], decisions: string[], actionItems: string[]): string {
    const summaryParts: string[] = []
    
    if (keyPoints.length > 0) {
      summaryParts.push(`主な議論点：${keyPoints.slice(0, 3).join('、')}`)
    }
    
    if (decisions.length > 0) {
      summaryParts.push(`決定事項：${decisions.length}件`)
    }
    
    if (actionItems.length > 0) {
      summaryParts.push(`アクションアイテム：${actionItems.length}件`)
    }
    
    return summaryParts.join('。') + '。'
  }

  // メイン要約機能
  public summarize(text: string): SummaryResult {
    const keyPoints = this.extractImportantSentences(text, 8)
    const decisions = this.extractDecisions(text)
    const actionItems = this.extractActionItems(text)
    const participants = this.extractParticipants(text)
    const meetingDuration = this.estimateMeetingDuration(text)
    const wordCount = this.extractWords(text).length
    const summary = this.generateSummary(keyPoints, decisions, actionItems)
    
    return {
      keyPoints,
      decisions,
      actionItems,
      participants,
      meetingDuration,
      wordCount,
      summary
    }
  }

  // キーワード分析
  public analyzeKeywords(text: string, topN: number = 10): KeywordScore[] {
    return this.calculateKeywordScores(text).slice(0, topN)
  }
}
