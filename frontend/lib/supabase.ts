import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

/**
 * No-op lock: runs the callback directly without using the Navigator Locks API.
 * Used to avoid AbortError ("signal is aborted without reason") from
 * navigator.locks.request when the lock times out or is aborted during
 * auth flows (e.g. OAuth callback, getSession).
 */
const lockNoOp = <R>(_name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> => fn()

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    lock: lockNoOp,
  },
})

export interface CarRow {
  id: string
  car_name: string
  car_model: string
  car_year?: number
  car_price?: number
  car_image_url?: string
  description?: string
  created_at?: string
}

export interface CarInsert {
  car_name: string
  car_model?: string
  car_year?: number
  car_price?: number
  car_image_url?: string
  description?: string
}
