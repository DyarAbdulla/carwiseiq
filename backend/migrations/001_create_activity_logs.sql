-- Create activity_logs table for tracking user activities
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  entity_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on user_id for faster queries
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);

-- Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);

-- Create index on type for filtering
CREATE INDEX IF NOT EXISTS idx_activity_logs_type ON activity_logs(type);

-- Enable Row Level Security
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only read their own activity logs
CREATE POLICY "Users can view own activity logs"
  ON activity_logs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own activity logs
CREATE POLICY "Users can insert own activity logs"
  ON activity_logs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own activity logs (optional, for cleanup)
CREATE POLICY "Users can delete own activity logs"
  ON activity_logs
  FOR DELETE
  USING (auth.uid() = user_id);
