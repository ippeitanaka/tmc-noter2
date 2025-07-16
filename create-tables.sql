-- audio_filesテーブルの作成
CREATE TABLE IF NOT EXISTS audio_files (
  id SERIAL PRIMARY KEY,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  transcript TEXT,
  minutes JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックスの作成
CREATE INDEX IF NOT EXISTS idx_audio_files_created_at ON audio_files(created_at);
