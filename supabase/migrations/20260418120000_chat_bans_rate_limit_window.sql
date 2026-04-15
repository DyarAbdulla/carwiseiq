-- Chat AI: profanity bans use public.user_bans only (no ip_bans in app).
-- Ensures columns exist on older DBs; aligns with 10 messages / 5h window in try_consume_chat_quota.

ALTER TABLE public.user_bans ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ;
ALTER TABLE public.user_bans ADD COLUMN IF NOT EXISTS ip_address TEXT;
ALTER TABLE public.user_bans ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE public.user_bans ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

COMMENT ON TABLE public.ai_chat_rate_limits IS
  'AI chat quota: identity_key = su:<uuid>|rest:<id>|ip:<addr>. Max 10 messages per rolling 5h window from window_start; enforced by backend try_consume_chat_quota.';
