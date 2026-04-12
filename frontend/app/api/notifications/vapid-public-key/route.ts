import { NextResponse } from 'next/server'

/** Public key for PushManager.subscribe (safe to expose). */
export async function GET() {
  const key =
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY || ''
  if (!key) {
    return NextResponse.json({ configured: false, publicKey: null }, { status: 200 })
  }
  return NextResponse.json({ configured: true, publicKey: key })
}
