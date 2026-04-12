-- Web Push subscriptions & send log (service role used from API routes)

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    prefs JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT push_subscriptions_endpoint_unique UNIQUE (endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);

DROP TRIGGER IF EXISTS trigger_push_subscriptions_updated_at ON public.push_subscriptions;
CREATE TRIGGER trigger_push_subscriptions_updated_at
    BEFORE UPDATE ON public.push_subscriptions
    FOR EACH ROW
    EXECUTE PROCEDURE public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.push_notification_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES public.push_subscriptions(id) ON DELETE CASCADE,
    notification_type TEXT NOT NULL,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    meta JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_push_notification_log_subscription_sent    ON public.push_notification_log(subscription_id, sent_at DESC);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_notification_log ENABLE ROW LEVEL SECURITY;

-- push_notification_log: no policies — only service_role (bypasses RLS) may write.

-- Subscribers manage their own rows (API may use service role to upsert on subscribe)
CREATE POLICY push_subscriptions_select_own ON public.push_subscriptions
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY push_subscriptions_insert_own ON public.push_subscriptions
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY push_subscriptions_update_own ON public.push_subscriptions
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY push_subscriptions_delete_own ON public.push_subscriptions
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

COMMENT ON TABLE public.push_subscriptions IS 'Web Push subscription endpoints per user/device.';
COMMENT ON TABLE public.push_notification_log IS 'Rate limiting and audit for outbound web push.';
