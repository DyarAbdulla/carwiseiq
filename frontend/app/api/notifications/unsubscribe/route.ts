import { NextRequest, NextResponse } from 'next/server'
import { getUserFromBearer } from '@/lib/api-auth'
import { getServiceClient } from '@/lib/supabase-service'

export async function DELETE(request: NextRequest) {
  const user = await getUserFromBearer(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let endpoint: string | undefined
  try {
    const body = await request.json()
    endpoint = typeof body?.endpoint === 'string' ? body.endpoint.trim() : undefined
  } catch {
    endpoint = undefined
  }
  if (!endpoint) {
    return NextResponse.json({ error: 'endpoint required' }, { status: 400 })
  }

  const service = getServiceClient()
  if (!service) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  const { error } = await service
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', endpoint)
    .eq('user_id', user.id)

  if (error) {
    console.error('[push unsubscribe]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
