-- Voucher codes, per-user redemptions, and supporting tables for usage/chat/bans.
-- Daily predict/compare counts remain in public.daily_feature_usage (per identity_key + local date).

-- ---------------------------------------------------------------------------
-- voucher_codes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.voucher_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    max_uses INTEGER NOT NULL CHECK (max_uses >= 0),
    current_uses INTEGER NOT NULL DEFAULT 0 CHECK (current_uses >= 0),
    benefits JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_voucher_codes_active ON public.voucher_codes (is_active) WHERE is_active;

COMMENT ON TABLE public.voucher_codes IS 'Promo/voucher definitions; benefits JSON e.g. {"unlimited_predictions": true, "daily_comparisons": 10}.';

-- ---------------------------------------------------------------------------
-- user_vouchers (snapshot of benefits at redeem time — permanent for account)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_vouchers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    voucher_code_id UUID NOT NULL REFERENCES public.voucher_codes (id) ON DELETE RESTRICT,
    benefits_granted JSONB NOT NULL DEFAULT '{}'::jsonb,
    redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, voucher_code_id)
);

CREATE INDEX IF NOT EXISTS idx_user_vouchers_user_id ON public.user_vouchers (user_id);

COMMENT ON TABLE public.user_vouchers IS 'Voucher redemptions; benefits_granted copied from voucher_codes.benefits at redeem.';

-- ---------------------------------------------------------------------------
-- usage_limits: documented companion to daily_feature_usage (same semantics)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.usage_limits (
    identity_key TEXT NOT NULL,
    usage_date DATE NOT NULL,
    predict_count INTEGER NOT NULL DEFAULT 0,
    compare_count INTEGER NOT NULL DEFAULT 0,
    last_reset_note TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (identity_key, usage_date)
);

CREATE INDEX IF NOT EXISTS idx_usage_limits_updated ON public.usage_limits (updated_at DESC);

COMMENT ON TABLE public.usage_limits IS 'Optional mirror of daily caps; primary store is daily_feature_usage until migrated.';

DROP TRIGGER IF EXISTS trigger_usage_limits_updated_at ON public.usage_limits;
CREATE TRIGGER trigger_usage_limits_updated_at
    BEFORE UPDATE ON public.usage_limits
    FOR EACH ROW
    EXECUTE PROCEDURE public.set_updated_at();

-- ---------------------------------------------------------------------------
-- chat_limits (reserved; live AI chat quota uses ai_chat_rate_limits)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chat_limits (
    identity_key TEXT PRIMARY KEY,
    message_count INTEGER NOT NULL DEFAULT 0,
    window_reset_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.chat_limits IS 'Reserved for chat quota by identity; production chat uses ai_chat_rate_limits.';

DROP TRIGGER IF EXISTS trigger_chat_limits_updated_at ON public.chat_limits;
CREATE TRIGGER trigger_chat_limits_updated_at
    BEFORE UPDATE ON public.chat_limits
    FOR EACH ROW
    EXECUTE PROCEDURE public.set_updated_at();

-- ---------------------------------------------------------------------------
-- user_bans (site-wide IP bans; chat moderation uses ip_bans)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_bans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address TEXT NOT NULL,
    reason TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ends_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_bans_ip_ends ON public.user_bans (ip_address, ends_at DESC);

COMMENT ON TABLE public.user_bans IS 'Optional IP ban list for app-wide enforcement; separate from ip_bans (chat).';

-- ---------------------------------------------------------------------------
-- Atomic redeem (service_role only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.redeem_voucher_code(p_user_id uuid, p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v public.voucher_codes%ROWTYPE;
BEGIN
    IF p_user_id IS NULL OR p_code IS NULL OR trim(p_code) = '' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'invalid');
    END IF;

    SELECT * INTO v
    FROM public.voucher_codes
    WHERE lower(trim(code)) = lower(trim(p_code))
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'invalid');
    END IF;

    IF NOT v.is_active THEN
        RETURN jsonb_build_object('ok', false, 'error', 'inactive');
    END IF;

    IF v.expires_at IS NOT NULL AND v.expires_at < now() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'expired');
    END IF;

    IF v.current_uses >= v.max_uses THEN
        RETURN jsonb_build_object('ok', false, 'error', 'exhausted');
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.user_vouchers uv
        WHERE uv.user_id = p_user_id AND uv.voucher_code_id = v.id
    ) THEN
        RETURN jsonb_build_object('ok', false, 'error', 'already_redeemed');
    END IF;

    INSERT INTO public.user_vouchers (user_id, voucher_code_id, benefits_granted)
    VALUES (p_user_id, v.id, v.benefits);

    UPDATE public.voucher_codes
    SET current_uses = current_uses + 1
    WHERE id = v.id;

    RETURN jsonb_build_object('ok', true, 'benefits', v.benefits);
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_voucher_code(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_voucher_code(uuid, text) TO service_role;

-- ---------------------------------------------------------------------------
-- RLS: server-side only (same pattern as ai_chat_rate_limits)
-- ---------------------------------------------------------------------------
ALTER TABLE public.voucher_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_bans ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Seed admin voucher
-- ---------------------------------------------------------------------------
INSERT INTO public.voucher_codes (code, max_uses, current_uses, benefits, is_active)
VALUES (
    'CARWISEDYAR11',
    1000,
    0,
    '{"unlimited_predictions": true, "daily_comparisons": 10}'::jsonb,
    true
)
ON CONFLICT (code) DO NOTHING;
