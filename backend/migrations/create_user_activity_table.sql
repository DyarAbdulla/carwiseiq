-- Create user_activity table for comprehensive activity tracking
-- This replaces/extends the activity_logs table with more activity types

CREATE TABLE IF NOT EXISTS user_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'prediction',
    'compare',
    'view_listing',
    'favorite',
    'create_listing',
    'edit_listing',
    'mark_sold'
  )),
  entity_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_activity_user_id ON user_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_type ON user_activity(type);
CREATE INDEX IF NOT EXISTS idx_user_activity_created_at ON user_activity(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_activity_user_type ON user_activity(user_id, type);

-- Enable Row Level Security
ALTER TABLE user_activity ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only read their own activities
CREATE POLICY "Users can view their own activities"
  ON user_activity
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policy: Users can only insert their own activities
CREATE POLICY "Users can insert their own activities"
  ON user_activity
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can only update their own activities
CREATE POLICY "Users can update their own activities"
  ON user_activity
  FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policy: Users can only delete their own activities
CREATE POLICY "Users can delete their own activities"
  ON user_activity
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add comment
COMMENT ON TABLE user_activity IS 'Comprehensive user activity tracking for predictions, comparisons, listings, favorites, etc.';
