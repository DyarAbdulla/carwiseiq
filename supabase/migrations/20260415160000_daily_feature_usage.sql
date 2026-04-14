-- Daily caps for single predictions (predict page) vs comparison batches (compare "Predict All").
-- usage_date = calendar date in the user's timezone (client sends IANA zone via X-Client-Timezone).

CREATE TABLE IF NOT EXISTS public.daily_feature_usage (
    identity_key TEXT NOT NULL,
    usage_date DATE NOT NULL,
    predict_count INTEGER NOT NULL DEFAULT 0,
    compare_count INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (identity_key, usage_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_feature_usage_updated ON public.daily_feature_usage (updated_at DESC);

COMMENT ON TABLE public.daily_feature_usage IS 'Per-day predict/compare counts; identity_key matches chat quota (su:/rest:/ip:).';

DROP TRIGGER IF EXISTS trigger_daily_feature_usage_updated_at ON public.daily_feature_usage;
CREATE TRIGGER trigger_daily_feature_usage_updated_at
    BEFORE UPDATE ON public.daily_feature_usage
    FOR EACH ROW
    EXECUTE PROCEDURE public.set_updated_at();

ALTER TABLE public.daily_feature_usage ENABLE ROW LEVEL SECURITY;
