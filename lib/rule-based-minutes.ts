// 超高精度ルールベース議事録生成（notta レベル）
export function generateMinutesRuleBased(transcript: string): {
  meetingName: string
  date: string
  participants: string
  agenda: string
  mainPoints: string[]
  decisions: string
  todos: string
  nextMeeting?: string
  meetingDetails?: string
} {
  console.log("🎯 Starting enhanced rule-based minutes generation")

  // 1. 高度な前処理とクリーニング
  const cleanedTranscript = performAdvancedCleaning(transcript)
  
  // 2. スピーカー分離とパーソナ識別
  const speakerAnalysis = performAdvancedSpeakerDiarization(cleanedTranscript)
  
  // 3. 議題・トピック自動抽出
  const topicAnalysis = performTopicAnalysis(cleanedTranscript)
  
  // 4. 決定事項の高精度抽出
  const decisionsAnalysis = performDecisionAnalysis(cleanedTranscript)
  
  // 5. アクションアイテムの詳細抽出
  const actionAnalysis = performActionItemAnalysis(cleanedTranscript)
  
  // 6. 時系列構造の復元
  const chronologyAnalysis = performChronologicalAnalysis(cleanedTranscript)

  // 7. 会議メタデータの推定
  const metadataAnalysis = performMetadataAnalysis(cleanedTranscript)

  console.log("✅ Enhanced rule-based analysis completed")

  return {
    meetingName: metadataAnalysis.meetingName,
    date: metadataAnalysis.date,
    participants: speakerAnalysis.participantList,
    agenda: topicAnalysis.mainAgenda,
    mainPoints: chronologyAnalysis.mainPoints,
    decisions: decisionsAnalysis.formattedDecisions,
    todos: actionAnalysis.formattedActions,
    nextMeeting: metadataAnalysis.nextMeeting,
    meetingDetails: generateMeetingDetails(speakerAnalysis, topicAnalysis, decisionsAnalysis, actionAnalysis)
  }
}

// 1. 高度なテキストクリーニング
function performAdvancedCleaning(transcript: string): string {
  console.log("🧹 Performing advanced text cleaning")
  
  let cleaned = transcript
    // フィラー除去（包括的）
    .replace(/\b(えー+と?|あー+|うー+|んー+|あの+|その+|えっと+|まぁ+|えー|あー|うー|んー)\b/g, '')
    .replace(/\b(ですね+|ありがとうございます|そうですね|なるほど|はいはい|そうそう)\b/g, '')
    
    // 言い直し・重複表現の整理
    .replace(/(.{5,}?)、\1/g, '$1') // 同じフレーズの繰り返し
    .replace(/\b(\w+)\s+\1\b/g, '$1') // 単語の重複
    
    // 句読点の正規化
    .replace(/[。．]/g, '。')
    .replace(/[、，]/g, '、')
    .replace(/\s*[。、]\s*/g, (match) => match.trim() + ' ')
    
    // 連続する空白・改行の整理
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, '\n')
    .trim()

  console.log(`📊 Cleaning stats: ${transcript.length} → ${cleaned.length} chars`)
  return cleaned
}

// 2. 高度なスピーカー分離
function performAdvancedSpeakerDiarization(transcript: string): {
  participantList: string
  speakerSegments: Array<{speaker: string, content: string}>
  speakerRoles: Map<string, string>
} {
  console.log("🎙️ Performing advanced speaker diarization")
  
  const speakerPatterns = [
    // 名前+敬称パターン
    /([A-Za-z\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]{1,15})(さん|様|氏|先生|部長|課長|主任|マネージャー)[:：]?\s*/g,
    // 役職パターン
    /(部長|課長|主任|リーダー|マネージャー|ディレクター|CTO|CEO)[:：]\s*/g,
    // 職種パターン
    /(エンジニア|デザイナー|プランナー|営業|マーケティング)[:：]\s*/g
  ]
  
  const speakers = new Map<string, Array<string>>()
  const speakerRoles = new Map<string, string>()
  let processedText = transcript
  
  // パターンマッチングによる話者抽出
  speakerPatterns.forEach(pattern => {
    let match
    while ((match = pattern.exec(transcript)) !== null) {
      const speakerKey = match[1] || match[0]
      const role = match[2] || ''
      
      if (!speakers.has(speakerKey)) {
        speakers.set(speakerKey, [])
        if (role) {
          speakerRoles.set(speakerKey, role)
        }
      }
    }
  })
  
  // 発言パターン分析
  const statements = transcript.split(/[。\n]/).filter(s => s.trim().length > 5)
  const speakerSegments: Array<{speaker: string, content: string}> = []
  
  statements.forEach(statement => {
    let assignedSpeaker = '発言者不明'
    
    // 既知の話者名が含まれているかチェック
    for (const [speaker] of speakers) {
      if (statement.includes(speaker)) {
        assignedSpeaker = speaker
        speakers.get(speaker)?.push(statement)
        break
      }
    }
    
    speakerSegments.push({
      speaker: assignedSpeaker,
      content: statement.trim()
    })
  })
  
  // 参加者リストの生成
  const participantList = Array.from(speakers.keys()).map(speaker => {
    const role = speakerRoles.get(speaker)
    return role ? `${speaker}${role}` : speaker
  }).join('、') || '参加者不明'
  
  console.log(`👥 Identified ${speakers.size} speakers: ${participantList}`)
  
  return {
    participantList,
    speakerSegments,
    speakerRoles
  }
}

// 3. トピック分析
function performTopicAnalysis(transcript: string): {
  mainAgenda: string
  topics: Array<{title: string, content: string, importance: number}>
} {
  console.log("📋 Performing topic analysis")
  
  const topicKeywords = {
    '予算・費用': ['予算', '費用', 'コスト', '金額', '価格', '円', '万円', '億円'],
    'スケジュール': ['スケジュール', '日程', '期限', '時期', '月', '日', '週間', '年'],
    '技術・開発': ['開発', '技術', 'システム', 'エンジニア', 'プログラム', 'アプリ'],
    '営業・マーケティング': ['営業', 'マーケティング', '顧客', 'お客様', '売上', '販売'],
    '人事・組織': ['採用', '人事', '組織', 'チーム', 'メンバー', '人材'],
    'プロジェクト管理': ['プロジェクト', '進捗', 'タスク', '課題', 'リスク', '品質']
  }
  
  const sentences = transcript.split(/[。\n]/).filter(s => s.trim().length > 10)
  const topics: Array<{title: string, content: string, importance: number}> = []
  
  // トピック別に文章を分類
  Object.entries(topicKeywords).forEach(([topic, keywords]) => {
    const relatedSentences = sentences.filter(sentence => 
      keywords.some(keyword => sentence.includes(keyword))
    )
    
    if (relatedSentences.length > 0) {
      topics.push({
        title: topic,
        content: relatedSentences.slice(0, 3).join('。'),
        importance: relatedSentences.length
      })
    }
  })
  
  // 重要度順にソート
  topics.sort((a, b) => b.importance - a.importance)
  
  const mainAgenda = topics.length > 0 ? 
    topics.map(t => t.title).slice(0, 3).join('、') + 'について' :
    '会議内容の議題'
  
  console.log(`📊 Identified ${topics.length} topics: ${mainAgenda}`)
  
  return {
    mainAgenda,
    topics
  }
}

// 4. 決定事項分析
function performDecisionAnalysis(transcript: string): {
  decisions: Array<{content: string, confidence: number}>
  formattedDecisions: string
} {
  console.log("✅ Performing decision analysis")
  
  const decisionPatterns = [
    /決定[しした]|決ま[ったり]|合意[しした]|承認[しした]|了承[しした]/g,
    /に[します|いたします]|を[します|いたします]|ということで/g,
    /方針[はを]|方向性[はを]|やり方[はを]/g
  ]
  
  const sentences = transcript.split(/[。\n]/).filter(s => s.trim().length > 5)
  const decisions: Array<{content: string, confidence: number}> = []
  
  sentences.forEach(sentence => {
    let confidence = 0
    
    decisionPatterns.forEach(pattern => {
      const matches = sentence.match(pattern)
      if (matches) {
        confidence += matches.length * 10
      }
    })
    
    // 決定を示す語彙の密度で信頼度を調整
    if (confidence > 0) {
      decisions.push({
        content: sentence.trim(),
        confidence: Math.min(confidence, 100)
      })
    }
  })
  
  // 信頼度順にソートして上位3つを選択
  decisions.sort((a, b) => b.confidence - a.confidence)
  const topDecisions = decisions.slice(0, 3)
  
  const formattedDecisions = topDecisions.length > 0 ? 
    topDecisions.map((d, i) => `${i + 1}. ${d.content}`).join('\n') :
    '明確な決定事項は確認されませんでした'
  
  console.log(`📝 Found ${decisions.length} potential decisions, selected top ${topDecisions.length}`)
  
  return {
    decisions,
    formattedDecisions
  }
}

// 5. アクションアイテム分析
function performActionItemAnalysis(transcript: string): {
  actions: Array<{content: string, priority: number, assignee?: string}>
  formattedActions: string
} {
  console.log("🎯 Performing action item analysis")
  
  const actionPatterns = [
    /([^\s]+)(さん|様|氏)[がに]?([^。]+)(する|します|やる|やります|お願い|依頼)/g,
    /(必要|べき|予定|今後|次回|確認|調査|検討|実施|実行|対応)/g,
    /(までに|期限|日程|スケジュール)/g
  ]
  
  const sentences = transcript.split(/[。\n]/).filter(s => s.trim().length > 5)
  const actions: Array<{content: string, priority: number, assignee?: string}> = []
  
  sentences.forEach(sentence => {
    let priority = 0
    let assignee: string | undefined
    
    // 担当者の特定
    const assigneeMatch = sentence.match(/([^\s]+)(さん|様|氏)[がに]?/)
    if (assigneeMatch) {
      assignee = assigneeMatch[1] + assigneeMatch[2]
      priority += 20
    }
    
    // アクション性の評価
    actionPatterns.forEach(pattern => {
      const matches = sentence.match(pattern)
      if (matches) {
        priority += matches.length * 5
      }
    })
    
    // 緊急度の評価
    if (sentence.includes('急') || sentence.includes('すぐ') || sentence.includes('至急')) {
      priority += 30
    }
    
    if (priority > 10) {
      actions.push({
        content: sentence.trim(),
        priority,
        assignee
      })
    }
  })
  
  // 優先度順にソート
  actions.sort((a, b) => b.priority - a.priority)
  const topActions = actions.slice(0, 5)
  
  const formattedActions = topActions.length > 0 ? 
    topActions.map((a, i) => `${i + 1}. ${a.content}${a.assignee ? ` (担当: ${a.assignee})` : ''}`).join('\n') :
    'アクションアイテムは特定されませんでした'
  
  console.log(`🎯 Found ${actions.length} actions, selected top ${topActions.length}`)
  
  return {
    actions,
    formattedActions
  }
}

// 6. 時系列分析
function performChronologicalAnalysis(transcript: string): {
  mainPoints: string[]
  timeline: Array<{time?: string, content: string}>
} {
  console.log("⏰ Performing chronological analysis")
  
  const sentences = transcript.split(/[。\n]/).filter(s => s.trim().length > 10)
  const timeline: Array<{time?: string, content: string}> = []
  
  // 時間表現の抽出
  const timePatterns = [
    /(\d{1,2}時\d{1,2}分|\d{1,2}時)/g,
    /(午前|午後)\d{1,2}時/g,
    /(最初に|次に|それから|その後|最後に|結論として)/g
  ]
  
  sentences.forEach(sentence => {
    let timeIndicator: string | undefined
    
    timePatterns.forEach(pattern => {
      const match = sentence.match(pattern)
      if (match) {
        timeIndicator = match[0]
      }
    })
    
    timeline.push({
      time: timeIndicator,
      content: sentence.trim()
    })
  })
  
  // 重要ポイントの抽出（長さと内容の重要度で判定）
  const importantSentences = sentences
    .filter(s => s.length > 20) // 一定の長さ以上
    .filter(s => !s.includes('えー') && !s.includes('あのー')) // フィラーが少ない
    .slice(0, 5) // 上位5つ
  
  const mainPoints = importantSentences.length > 0 ? 
    importantSentences.map((point, i) => `${i + 1}. ${point}`) :
    ['議事内容の要約に失敗しました']
  
  console.log(`📊 Extracted ${mainPoints.length} main points from ${timeline.length} timeline items`)
  
  return {
    mainPoints,
    timeline
  }
}

// 7. メタデータ分析
function performMetadataAnalysis(transcript: string): {
  meetingName: string
  date: string
  nextMeeting: string
} {
  console.log("📊 Performing metadata analysis")
  
  // 日付の抽出（多様なパターンに対応）
  const datePatterns = [
    /(\d{4}年\d{1,2}月\d{1,2}日)/g,
    /(令和\d{1,2}年\d{1,2}月\d{1,2}日)/g,
    /(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/g,
    /(\d{1,2}月\d{1,2}日)/g
  ]
  
  let date = new Date().toLocaleDateString('ja-JP')
  datePatterns.forEach(pattern => {
    const match = transcript.match(pattern)
    if (match) {
      date = match[1]
    }
  })
  
  // 会議名の推定
  const meetingTypeKeywords = {
    '定例会議': ['定例', '週次', '月次', 'ウィークリー', 'マンスリー'],
    'プロジェクト会議': ['プロジェクト', 'PJ', '開発', 'システム'],
    '営業会議': ['営業', 'セールス', '売上', '顧客'],
    '予算会議': ['予算', '費用', 'コスト', '財務'],
    '人事会議': ['人事', '採用', '評価', '組織']
  }
  
  let meetingName = '会議'
  Object.entries(meetingTypeKeywords).forEach(([type, keywords]) => {
    if (keywords.some(keyword => transcript.includes(keyword))) {
      meetingName = type
    }
  })
  
  // 次回会議の抽出
  const nextMeetingPatterns = [
    /次回[は]?(\d{1,2}月\d{1,2}日|\d{1,2}\/\d{1,2})/g,
    /次の会議[は]?(\d{1,2}月\d{1,2}日)/g,
    /来週|来月|再来週/g
  ]
  
  let nextMeeting = ''
  nextMeetingPatterns.forEach(pattern => {
    const match = transcript.match(pattern)
    if (match) {
      nextMeeting = match[0]
    }
  })
  
  console.log(`📝 Meeting metadata: ${meetingName}, ${date}, Next: ${nextMeeting || 'TBD'}`)
  
  return {
    meetingName,
    date,
    nextMeeting
  }
}

// 8. 議事録詳細の生成
function generateMeetingDetails(
  speakerAnalysis: any,
  topicAnalysis: any, 
  decisionsAnalysis: any,
  actionAnalysis: any
): string {
  console.log("📋 Generating detailed meeting summary")
  
  const details = []
  
  // 話者情報
  if (speakerAnalysis.speakerSegments.length > 0) {
    details.push('## 発言者別サマリー')
    speakerAnalysis.speakerSegments.slice(0, 3).forEach((segment: any) => {
      details.push(`**${segment.speaker}**: ${segment.content.slice(0, 100)}...`)
    })
  }
  
  // トピック詳細
  if (topicAnalysis.topics.length > 0) {
    details.push('\n## 主要トピック詳細')
    topicAnalysis.topics.slice(0, 3).forEach((topic: any, index: number) => {
      details.push(`${index + 1}. **${topic.title}**: ${topic.content.slice(0, 150)}...`)
    })
  }
  
  // 信頼度の高い決定事項
  if (decisionsAnalysis.decisions.length > 0) {
    details.push('\n## 決定事項の詳細')
    decisionsAnalysis.decisions.slice(0, 2).forEach((decision: any, index: number) => {
      details.push(`${index + 1}. ${decision.content} (信頼度: ${decision.confidence}%)`)
    })
  }
  
  return details.join('\n') || '詳細情報の生成に失敗しました'
}
