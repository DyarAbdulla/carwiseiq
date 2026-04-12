import { NextRequest, NextResponse } from 'next/server'
import { getUserFromBearer } from '@/lib/api-auth'
import { getServiceClient } from '@/lib/supabase-service'
import { defaultPushPrefs, mergePushPrefs, type PushPrefs } from '@/lib/push/types'
import type { Json } from '@/lib/database.types'

function mergedDefaults(prefs: PushPrefs): Json {
  const base = mergePushPrefs(null)
  return {
    ...base,
    ...prefs,
    watchMakes: prefs.watchMakes ?? base.watchMakes,
    watchModels: prefs.watchModels ?? base.watchModels,
  } as unknown as Json
}

export async function GET(request: NextRequest) {
  const user = await getUserFromBearer(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const service = getServiceClient()
  if (!service) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  const { data, error } = await service
    .from('push_subscriptions')
    .select('prefs')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('[push prefs get]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const prefs = data?.prefs
    ? { ...defaultPushPrefs, ...mergePushPrefs(data.prefs) }
    : { ...defaultPushPrefs }
  return NextResponse.json({ prefs })
}

export async function PATCH(request: NextRequest) {
  const user = await getUserFromBearer(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let patch: PushPrefs
  try {
    patch = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const service = getServiceClient()
  if (!service) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  const { data: rows, error: readErr } = await service
    .from('push_subscriptions')
    .select('id, prefs')
    .eq('user_id', user.id)

  if (readErr) {
    console.error('[push prefs patch read]', readErr)
    return NextResponse.json({ error: readErr.message }, { status: 500 })
  }

  if (!rows?.length) {
    return NextResponse.json(
      { error: 'No push subscription; enable notifications on a device first.' },
      { status: 404 }
    )
  }

  const nextPrefs = mergedDefaults({
    ...mergePushPrefs(rows[0]!.prefs),
    ...patch,
  })

  const { error: updErr } = await service
    .from('push_subscriptions')
    .update({ prefs: nextPrefs, updated_at: new Date().toISOString() })
    .eq('user_id', user.id)

  if (updErr) {
    console.error('[push prefs patch]', updErr)
    return NextResponse.json({ error: updErr.message }, { status: 500 })
  }

  return NextResponse.json({ prefs: mergePushPrefs(nextPrefs) })
}
