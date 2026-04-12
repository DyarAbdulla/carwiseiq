import { NextRequest, NextResponse } from 'next/server'
import { getUserFromBearer } from '@/lib/api-auth'
import { getServiceClient } from '@/lib/supabase-service'
import { configureWebPush, webpush } from '@/lib/push/webpush-config'
import { mergePushPrefs } from '@/lib/push/types'
import { subscriptionMatchesListing } from '@/lib/push/match'
import { newListingCopy, type ListingBrief } from '@/lib/push/server-messages'
import { baghdadStartOfDayIso, isIraqSendingWindow } from '@/lib/push/iraq-time'
import type { Json } from '@/lib/database.types'

const MAX_PUSH_PER_DAY = 3
const ORIGIN =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'https://carwiseiq.com'

function firstImageUrl(images: unknown): string | undefined {
  if (!Array.isArray(images) || images.length === 0) return undefined
  const u = images[0]
  return typeof u === 'string' ? u : undefined
}

export async function POST(request: NextRequest) {
  if (!configureWebPush()) {
    return NextResponse.json({ error: 'VAPID not configured' }, { status: 503 })
  }

  const user = await getUserFromBearer(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let listingId: string
  try {
    const body = await request.json()
    listingId = typeof body?.listingId === 'string' ? body.listingId.trim() : ''
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (!listingId) {
    return NextResponse.json({ error: 'listingId required' }, { status: 400 })
  }

  const service = getServiceClient()
  if (!service) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  const { data: listing, error: listingErr } = await service
    .from('car_listings')
    .select('id, user_id, make, model, year, price, location, images')
    .eq('id', listingId)
    .maybeSingle()

  if (listingErr || !listing) {
    return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
  }

  if (listing.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!isIraqSendingWindow()) {
    return NextResponse.json({ ok: true, skipped: 'outside_sending_window', sent: 0 })
  }

  const brief: ListingBrief = {
    id: listing.id,
    make: listing.make,
    model: listing.model,
    year: listing.year,
    price: Number(listing.price),
    location: listing.location,
    imageUrl: firstImageUrl(listing.images),
  }

  const { data: subs, error: subsErr } = await service.from('push_subscriptions').select(
    'id, user_id, endpoint, p256dh, auth, prefs'
  )

  if (subsErr || !subs?.length) {
    return NextResponse.json({ ok: true, sent: 0, reason: 'no_subscribers' })
  }

  const dayStart = baghdadStartOfDayIso()
  let sent = 0
  const errors: string[] = []

  for (const row of subs) {
    const prefs = mergePushPrefs(row.prefs as Json)
    if (
      !subscriptionMatchesListing(listing.user_id, row.user_id, prefs, brief)
    ) {
      continue
    }

    const { count, error: cErr } = await service
      .from('push_notification_log')
      .select('*', { count: 'exact', head: true })
      .eq('subscription_id', row.id)
      .gte('sent_at', dayStart)

    if (cErr) {
      errors.push(cErr.message)
      continue
    }
    if ((count ?? 0) >= MAX_PUSH_PER_DAY) continue

    const { title, body } = newListingCopy(prefs, brief)
    const locale = (prefs.locale || 'en').toLowerCase()
    const loc = ['en', 'ar', 'ku'].includes(locale) ? locale : 'en'
    const url = `${ORIGIN.replace(/\/$/, '')}/${loc}/buy-sell?id=${encodeURIComponent(brief.id)}`

    const payload = {
      title,
      body,
      icon: `${ORIGIN.replace(/\/$/, '')}/icons/icon-192x192.png`,
      badge: `${ORIGIN.replace(/\/$/, '')}/icons/icon-192x192.png`,
      image: brief.imageUrl || undefined,
      data: {
        url,
        type: 'new_listing',
        tag: `listing-${brief.id}`,
      },
    }

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
        notification_type: 'new_listing',
        meta: { listing_id: brief.id } as Json,
      })
      sent++
    } catch (e: unknown) {
      const code = (e as { statusCode?: number })?.statusCode
      if (code === 404 || code === 410) {
        await service.from('push_subscriptions').delete().eq('id', row.id)
      } else {
        errors.push((e as Error)?.message || 'send failed')
      }
    }
  }

  return NextResponse.json({ ok: true, sent, errors: errors.length ? errors : undefined })
}
