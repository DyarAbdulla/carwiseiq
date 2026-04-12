import { createClient } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'
import type { User } from '@supabase/supabase-js'
import type { Database } from './database.types'

export async function getUserFromBearer(request: NextRequest): Promise<User | null> {
  const auth = request.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  const jwt = auth.slice(7).trim()
  if (!jwt) return null
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) return null
  const supabase = createClient<Database>(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(jwt)
  if (error || !user) return null
  return user
}
