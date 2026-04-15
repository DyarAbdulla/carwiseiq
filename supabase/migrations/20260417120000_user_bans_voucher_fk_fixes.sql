-- Documented migrations (CarWiseIQ BUG 2 & BUG 3 fixes):
-- BUG 2: Backend chat security reads public.user_bans only (ip_bans removed from app code).
--   - ends_at: nullable means permanent ban (NULL = no expiry).
--   - banned_at: optional audit timestamp when ban was recorded.
-- BUG 3: Ensure user_vouchers.voucher_code_id references voucher_codes.id for PostgREST embeds
--   (deployments that missed the original FK still get a repair path).

-- ---------------------------------------------------------------------------
-- user_bans: align with chat_security_service (ends_at nullable, banned_at)
-- ---------------------------------------------------------------------------
ALTER TABLE public.user_bans ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ;
ALTER TABLE public.user_bans ADD COLUMN IF NOT EXISTS banned_at TIMESTAMPTZ DEFAULT NOW();

UPDATE public.user_bans
SET banned_at = COALESCE(banned_at, started_at, created_at, NOW())
WHERE banned_at IS NULL;

ALTER TABLE public.user_bans ALTER COLUMN ends_at DROP NOT NULL;

COMMENT ON COLUMN public.user_bans.ends_at IS 'Ban expiry; NULL = permanent ban.';
COMMENT ON COLUMN public.user_bans.banned_at IS 'When the ban row was created (audit).';

-- ---------------------------------------------------------------------------
-- user_vouchers → voucher_codes FK (idempotent)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'user_vouchers'
      AND c.conname = 'fk_user_vouchers_voucher_code'
  ) THEN
    ALTER TABLE public.user_vouchers
      ADD CONSTRAINT fk_user_vouchers_voucher_code
      FOREIGN KEY (voucher_code_id)
      REFERENCES public.voucher_codes (id)
      ON DELETE RESTRICT;
  END IF;
END $$;
