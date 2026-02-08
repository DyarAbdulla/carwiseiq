/**
 * Database query utilities for car listings and admin operations.
 * Uses Supabase client; RLS enforces ownership and admin checks.
 */

import { supabase } from '@/lib/supabase'
import type {
  CarListing,
  CarListingInsert,
  CarListingUpdate,
} from '@/lib/database.types'

export type QueryResult<T> =
  | { data: T; error: null }
  | { data: null; error: Error }

export type ListingOwner = {
  email: string
  full_name: string | null
  phone_number: string | null
}

export type CarListingWithOwner = CarListing & { owner: ListingOwner | null }

// --- Car listings (user-facing) ---

/**
 * Fetch all active listings for the marketplace.
 * Orders by created_at desc.
 */
export async function getAllListings(): Promise<QueryResult<CarListing[]>> {
  try {
    const { data, error } = await supabase
      .from('car_listings')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    if (error) {
      return { data: null, error: new Error(error.message) }
    }
    return { data: (data ?? []) as CarListing[], error: null }
  } catch (e) {
    return {
      data: null,
      error: e instanceof Error ? e : new Error('Failed to fetch listings'),
    }
  }
}

/**
 * Fetch listings owned by a specific user.
 */
export async function getUserListings(
  userId: string
): Promise<QueryResult<CarListing[]>> {
  try {
    const { data, error } = await supabase
      .from('car_listings')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      return { data: null, error: new Error(error.message) }
    }
    return { data: (data ?? []) as CarListing[], error: null }
  } catch (e) {
    return {
      data: null,
      error: e instanceof Error ? e : new Error('Failed to fetch user listings'),
    }
  }
}

/**
 * Fetch a single listing by id with owner info (email, full_name, phone_number).
 */
export async function getListingById(
  id: string
): Promise<QueryResult<CarListingWithOwner>> {
  try {
    const { data: listing, error: listingError } = await supabase
      .from('car_listings')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (listingError) {
      return { data: null, error: new Error(listingError.message) }
    }
    if (!listing) {
      return { data: null, error: new Error('Listing not found') }
    }

    const { data: owner, error: ownerError } = await supabase
      .from('users')
      .select('email, full_name, phone_number')
      .eq('id', (listing as CarListing).user_id)
      .maybeSingle()

    if (ownerError) {
      return {
        data: { ...(listing as CarListing), owner: null },
        error: null,
      }
    }

    const ownerInfo: ListingOwner | null = owner
      ? {
          email: owner.email,
          full_name: owner.full_name ?? null,
          phone_number: owner.phone_number ?? null,
        }
      : null

    return {
      data: { ...(listing as CarListing), owner: ownerInfo },
      error: null,
    }
  } catch (e) {
    return {
      data: null,
      error: e instanceof Error ? e : new Error('Failed to fetch listing'),
    }
  }
}

/**
 * Create a new listing. RLS requires auth.uid() = user_id.
 */
export async function createListing(
  data: CarListingInsert
): Promise<QueryResult<CarListing>> {
  try {
    const { data: row, error } = await supabase
      .from('car_listings')
      .insert(data)
      .select()
      .single()

    if (error) {
      return { data: null, error: new Error(error.message) }
    }
    return { data: row as CarListing, error: null }
  } catch (e) {
    return {
      data: null,
      error: e instanceof Error ? e : new Error('Failed to create listing'),
    }
  }
}

/**
 * Update a listing. RLS enforces ownership (only owner can update).
 */
export async function updateListing(
  id: string,
  data: CarListingUpdate
): Promise<QueryResult<CarListing>> {
  try {
    const { data: row, error } = await supabase
      .from('car_listings')
      .update(data)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return { data: null, error: new Error(error.message) }
    }
    return { data: row as CarListing, error: null }
  } catch (e) {
    return {
      data: null,
      error: e instanceof Error ? e : new Error('Failed to update listing'),
    }
  }
}

/**
 * Delete a listing. RLS enforces ownership (only owner can delete).
 */
export async function deleteListing(
  id: string
): Promise<QueryResult<void>> {
  try {
    const { error } = await supabase
      .from('car_listings')
      .delete()
      .eq('id', id)

    if (error) {
      return { data: null, error: new Error(error.message) }
    }
    return { data: undefined, error: null }
  } catch (e) {
    return {
      data: null,
      error: e instanceof Error ? e : new Error('Failed to delete listing'),
    }
  }
}

/**
 * Toggle is_sold for a listing. RLS enforces ownership.
 * Fetches current value, then updates.
 */
export async function toggleSold(id: string): Promise<QueryResult<CarListing>> {
  try {
    const { data: current, error: fetchError } = await supabase
      .from('car_listings')
      .select('is_sold')
      .eq('id', id)
      .maybeSingle()

    if (fetchError) {
      return { data: null, error: new Error(fetchError.message) }
    }
    if (!current) {
      return { data: null, error: new Error('Listing not found') }
    }

    const { data: updated, error: updateError } = await supabase
      .from('car_listings')
      .update({ is_sold: !(current as { is_sold: boolean }).is_sold })
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      return { data: null, error: new Error(updateError.message) }
    }
    return { data: updated as CarListing, error: null }
  } catch (e) {
    return {
      data: null,
      error: e instanceof Error ? e : new Error('Failed to toggle sold status'),
    }
  }
}

// --- Admin (RLS: requires role = 'admin' in public.users) ---

/**
 * Fetch ALL listings regardless of status. Admin-only (RLS).
 * Caller must be authenticated as admin.
 */
export async function getAllListingsAdmin(): Promise<
  QueryResult<CarListing[]>
> {
  try {
    const { data, error } = await supabase
      .from('car_listings')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      return { data: null, error: new Error(error.message) }
    }
    return { data: (data ?? []) as CarListing[], error: null }
  } catch (e) {
    return {
      data: null,
      error:
        e instanceof Error ? e : new Error('Failed to fetch admin listings'),
    }
  }
}

/**
 * Update any listing. Admin-only (RLS).
 * Caller must be authenticated as admin.
 */
export async function updateListingAdmin(
  id: string,
  data: CarListingUpdate
): Promise<QueryResult<CarListing>> {
  try {
    const { data: row, error } = await supabase
      .from('car_listings')
      .update(data)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return { data: null, error: new Error(error.message) }
    }
    return { data: row as CarListing, error: null }
  } catch (e) {
    return {
      data: null,
      error:
        e instanceof Error ? e : new Error('Failed to update listing (admin)'),
    }
  }
}

/**
 * Delete any listing. Admin-only (RLS).
 * Caller must be authenticated as admin.
 */
export async function deleteListingAdmin(
  id: string
): Promise<QueryResult<void>> {
  try {
    const { error } = await supabase
      .from('car_listings')
      .delete()
      .eq('id', id)

    if (error) {
      return { data: null, error: new Error(error.message) }
    }
    return { data: undefined, error: null }
  } catch (e) {
    return {
      data: null,
      error:
        e instanceof Error ? e : new Error('Failed to delete listing (admin)'),
    }
  }
}
