-- AI chat rate limits (per logged-in user or guest IP), profanity strikes, and IP bans (site-wide).

-- Rolling window: first message starts window; max 10 messages per 120 minutes; window resets 120 min from window_start.
CREATE TABLE IF NOT EXISTS public.ai_chat_rate_limits (
    identity_key TEXT PRIMARY KEY,
    window_start TIMESTAMPTZ NOT NULL,
    message_count INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ai_chat_rate_limits IS 'AI assistant chat quota: identity_key = su:<uuid> | rest:<id> | ip:<address>';

CREATE INDEX IF NOT EXISTS idx_ai_chat_rate_limits_updated ON public.ai_chat_rate_limits (updated_at DESC);

-- Profanity strike count per IP (warning then ban on repeat offense).
CREATE TABLE IF NOT EXISTS public.ai_chat_profanity_strikes (
    ip_address TEXT PRIMARY KEY,
    strike_count INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ai_chat_profanity_strikes IS 'Tracks AI chat profanity warnings per client IP.';

DROP TRIGGER IF EXISTS trigger_ai_chat_rate_limits_updated_at ON public.ai_chat_rate_limits;
CREATE TRIGGER trigger_ai_chat_rate_limits_updated_at
    BEFORE UPDATE ON public.ai_chat_rate_limits
    FOR EACH ROW
    EXECUTE PROCEDURE public.set_updated_at();

DROP TRIGGER IF EXISTS trigger_ai_chat_profanity_strikes_updated_at ON public.ai_chat_profanity_strikes;
CREATE TRIGGER trigger_ai_chat_profanity_strikes_updated_at
    BEFORE UPDATE ON public.ai_chat_profanity_strikes
    FOR EACH ROW
    EXECUTE PROCEDURE public.set_updated_at();

-- Site-wide temporary IP bans (enforced in Next.js middleware + chat API).
CREATE TABLE IF NOT EXISTS public.ip_bans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address TEXT NOT NULL,
    reason TEXT NOT NULL,
    starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ends_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ip_bans_ip_ends ON public.ip_bans (ip_address, ends_at DESC);

COMMENT ON TABLE public.ip_bans IS 'Temporary IP blocks (e.g. repeated AI chat profanity).';

ALTER TABLE public.ai_chat_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_chat_profanity_strikes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ip_bans ENABLE ROW LEVEL SECURITY;

-- No policies: only service_role (server) accesses these tables via PostgREST.
