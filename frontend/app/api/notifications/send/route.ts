import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase-service'
import { configureWebPush, webpush } from '@/lib/push/webpush-config'
import { mergePushPrefs } from '@/lib/push/types'
import { priceDropCopy, marketTrendCopy, type ListingBrief } from '@/lib/push/server-messages'
import { baghdadStartOfDayIso, isIraqSendingWindow } from '@/lib/push/iraq-time'
import type { Json } from '@/lib/database.types'

const MAX_PUSH_PER_DAY = 3
const ORIGIN =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'https://carwiseiq.com'

type SendBody = {
  type: 'price_drop' | 'market_trend'
  /** price_drop */
  listing?: Pick<ListingBrief, 'make' | 'model'>
  newPrice?: number
  listingId?: string
  imageUrl?: string
  /** market_trend */
  make?: string
  count?: number
  region?: string
  /** limit to one user */
  userId?: string
}

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-admin-secret')
  if (!secret || secret !== process.env.NOTIFICATIONS_CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!configureWebPush()) {
    return NextResponse.json({ error: 'VAPID not configured' }, { status: 503 })
  }

  let body: SendBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!isIraqSendingWindow()) {
    return NextResponse.json({ ok: true, skipped: 'outside_sending_window', sent: 0 })
  }

  const service = getServiceClient()
  if (!service) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  let q = service.from('push_subscriptions').select('id, user_id, endpoint, p256dh, auth, prefs')
  if (body.userId) {
    q = q.eq('user_id', body.userId)
  }
  const { data: subs, error: subsErr } = await q

  if (subsErr || !subs?.length) {
    return NextResponse.json({ ok: true, sent: 0 })
  }

  const dayStart = baghdadStartOfDayIso()
  let sent = 0

  for (const row of subs) {
    const prefs = mergePushPrefs(row.prefs as Json)
    let payload: Record<string, unknown>

    if (body.type === 'price_drop') {
      if (prefs.priceDrop === false) continue
      if (!body.listing || body.newPrice == null) continue
      const { title, body: text } = priceDropCopy(prefs, body.listing, body.newPrice)
      const locale = (prefs.locale || 'en').toLowerCase()
      const loc = ['en', 'ar', 'ku'].includes(locale) ? locale : 'en'
      const url = body.listingId
        ? `${ORIGIN.replace(/\/$/, '')}/${loc}/buy-sell?id=${encodeURIComponent(body.listingId)}`
        : `${ORIGIN.replace(/\/$/, '')}/${loc}/buy-sell`

      payload = {
        title,
        body: text,
        icon: `${ORIGIN.replace(/\/$/, '')}/icons/icon-192x192.png`,
        badge: `${ORIGIN.replace(/\/$/, '')}/icons/icon-192x192.png`,
        image: body.imageUrl,
        data: { url, type: 'price_drop', tag: body.listingId ? `listing-${body.listingId}` : 'price_drop' },
      }
    } else if (body.type === 'market_trend') {
      if (prefs.marketTrend === false) continue
      if (!body.make || body.count == null || !body.region) continue
      const { title, body: text } = marketTrendCopy(prefs, body.make, body.count, body.region)
      const locale = (prefs.locale || 'en').toLowerCase()
      const loc = ['en', 'ar', 'ku'].includes(locale) ? locale : 'en'
      payload = {
        title,
        body: text,
        icon: `${ORIGIN.replace(/\/$/, '')}/icons/icon-192x192.png`,
        badge: `${ORIGIN.replace(/\/$/, '')}/icons/icon-192x192.png`,
        data: {
          url: `${ORIGIN.replace(/\/$/, '')}/${loc}/buy-sell`,
          type: 'market_trend',
          tag: 'market-trend',
        },
      }
    } else {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
    }

    const { count, error: cErr } = await service
      .from('push_notification_log')
      .select('*', { count: 'exact', head: true })
      .eq('subscription_id', row.id)
      .gte('sent_at', dayStart)

    if (cErr || (count ?? 0) >= MAX_PUSH_PER_DAY) continue

    try {
      await webpush.sendNotification(
        {
          endpoint: row.endpoint,
          keys: { p256dh: row.p256dh, auth: row.auth },
        },
        JSON.stringify(payload),
        { TTL: 86400 }
      )
      await service.from('push_notification_log').insert({
        subscription_id: row.id,
        notification_type: body.type,
        meta: {} as Json,
      })
      sent++
    } catch (e: unknown) {
      const code = (e as { statusCode?: number })?.statusCode
      if (code === 404 || code === 410) {
        await service.from('push_subscriptions').delete().eq('id', row.id)
      }
    }
  }

  return NextResponse.json({ ok: true, sent })
}
