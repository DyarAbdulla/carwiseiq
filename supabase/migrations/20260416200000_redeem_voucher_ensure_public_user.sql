-- Ensure public.users exists before inserting user_vouchers (fixes FK failures when trigger missed / legacy accounts).

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

    INSERT INTO public.users (id, email, full_name, phone_number, role, is_verified)
    SELECT
        au.id,
        COALESCE(NULLIF(trim(au.email), ''), 'user+' || replace(au.id::text, '-', '') || '@users.local'),
        COALESCE(
            NULLIF(trim(COALESCE(au.raw_user_meta_data->>'full_name', '')), ''),
            NULLIF(trim(COALESCE(au.raw_user_meta_data->>'name', '')), ''),
            NULL
        ),
        NULLIF(trim(COALESCE(au.raw_user_meta_data->>'phone_number', '')), ''),
        'user',
        (au.email_confirmed_at IS NOT NULL)
    FROM auth.users au
    WHERE au.id = p_user_id
    ON CONFLICT (id) DO NOTHING;

    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id) THEN
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
