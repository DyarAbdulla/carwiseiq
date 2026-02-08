/**
 * Supabase database types (manual, from migrations).
 * Regenerate with: npx supabase gen types typescript --linked > lib/database.types.ts
 * when linked to a project and DB is available.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type UserRole = 'user' | 'admin'
export type Transmission = 'automatic' | 'manual'
export type FuelType = 'petrol' | 'diesel' | 'electric' | 'hybrid'
export type CarCondition = 'excellent' | 'good' | 'fair'
export type ListingStatus = 'active' | 'pending' | 'rejected'

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          full_name: string | null
          phone_number: string | null
          role: UserRole
          created_at: string
          updated_at: string
          is_verified: boolean
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          phone_number?: string | null
          role?: UserRole
          created_at?: string
          updated_at?: string
          is_verified?: boolean
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          phone_number?: string | null
          role?: UserRole
          created_at?: string
          updated_at?: string
          is_verified?: boolean
        }
      }
      car_listings: {
        Row: {
          id: string
          user_id: string
          title: string
          make: string
          model: string
          year: number
          price: number
          mileage: number
          transmission: Transmission
          fuel_type: FuelType
          condition: CarCondition
          location: string
          description: string | null
          images: Json
          phone: string | null
          whatsapp: string | null
          is_sold: boolean
          sold_at: string | null
          status: ListingStatus
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          make: string
          model: string
          year: number
          price: number
          mileage: number
          transmission: Transmission
          fuel_type: FuelType
          condition: CarCondition
          location: string
          description?: string | null
          images?: Json
          phone?: string | null
          whatsapp?: string | null
          is_sold?: boolean
          sold_at?: string | null
          status?: ListingStatus
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          make?: string
          model?: string
          year?: number
          price?: number
          mileage?: number
          transmission?: Transmission
          fuel_type?: FuelType
          condition?: CarCondition
          location?: string
          description?: string | null
          images?: Json
          phone?: string | null
          whatsapp?: string | null
          is_sold?: boolean
          sold_at?: string | null
          status?: ListingStatus
          created_at?: string
          updated_at?: string
        }
      }
      favorites: {
        Row: {
          id: string
          user_id: string
          listing_id: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          listing_id: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          listing_id?: string
          created_at?: string
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}

/** Row type for a given table */
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

/** Insert payload for a given table */
export type Insertable<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']

/** Update payload for a given table */
export type Updatable<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']

/** Convenience aliases */
export type User = Tables<'users'>
export type UserInsert = Insertable<'users'>
export type UserUpdate = Updatable<'users'>

export type CarListing = Tables<'car_listings'>
export type CarListingInsert = Insertable<'car_listings'>
export type CarListingUpdate = Updatable<'car_listings'>

export type Favorite = Tables<'favorites'>
export type FavoriteInsert = Insertable<'favorites'>
export type FavoriteUpdate = Updatable<'favorites'>
