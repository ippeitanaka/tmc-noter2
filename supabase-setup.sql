-- 1. audio_filesテーブルの作成（存在しない場合）
CREATE TABLE IF NOT EXISTS audio_files (
  id SERIAL PRIMARY KEY,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  transcript TEXT,
  minutes JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. インデックスの作成
CREATE INDEX IF NOT EXISTS idx_audio_files_created_at ON audio_files(created_at);
CREATE INDEX IF NOT EXISTS idx_audio_files_file_path ON audio_files(file_path);

-- 3. RLS（Row Level Security）の設定
ALTER TABLE audio_files ENABLE ROW LEVEL SECURITY;

-- 4. 匿名ユーザーがすべての操作を実行できるポリシー（開発用）
-- 本番環境では適切な認証ポリシーに変更してください
CREATE POLICY IF NOT EXISTS "Allow anonymous access" ON audio_files
  FOR ALL USING (true);

-- 5. ストレージバケットの作成
INSERT INTO storage.buckets (id, name, public)
VALUES ('tmc-noter', 'tmc-noter', true)
ON CONFLICT (id) DO NOTHING;

-- 6. ストレージポリシーの設定
CREATE POLICY IF NOT EXISTS "Allow anonymous uploads" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'tmc-noter');

CREATE POLICY IF NOT EXISTS "Allow anonymous downloads" ON storage.objects
  FOR SELECT USING (bucket_id = 'tmc-noter');

CREATE POLICY IF NOT EXISTS "Allow anonymous deletes" ON storage.objects
  FOR DELETE USING (bucket_id = 'tmc-noter');

-- 7. テーブル構造の確認
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'audio_files'
ORDER BY ordinal_position;

-- 8. 既存データの確認
SELECT COUNT(*) as total_records FROM audio_files;

-- 9. ストレージバケットの確認
SELECT * FROM storage.buckets WHERE name = 'tmc-noter';
