import { NextRequest, NextResponse } from 'next/server'
import { getUserFromBearer } from '@/lib/api-auth'
import { getServiceClient } from '@/lib/supabase-service'
import type { Json } from '@/lib/database.types'
import { defaultPushPrefs, mergePushPrefs, type PushPrefs } from '@/lib/push/types'

type Body = {
  subscription?: {
    endpoint?: string
    keys?: { p256dh?: string; auth?: string }
  }
  prefs?: PushPrefs
}

export async function POST(request: NextRequest) {
  const user = await getUserFromBearer(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const sub = body.subscription
  const endpoint = sub?.endpoint?.trim()
  const p256dh = sub?.keys?.p256dh
  const auth = sub?.keys?.auth
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })
  }

  const service = getServiceClient()
  if (!service) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  const prefs = {
    ...defaultPushPrefs,
    ...mergePushPrefs((body.prefs || null) as Json),
  }

  const { error } = await service.from('push_subscriptions').upsert(
    {
      user_id: user.id,
      endpoint,
      p256dh,
      auth,
      prefs: prefs as unknown as Json,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'endpoint' }
  )

  if (error) {
    console.error('[push subscribe]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
