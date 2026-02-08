# Troubleshooting: car_listings INSERT hang

If the Publish flow hangs at "Inserting to database..." and hits the **10-second timeout**, run these in the **Supabase SQL Editor** to isolate the cause.

## 1. Test without RLS (temporary)

RLS can block inserts without returning an error in some edge cases. To test:

```sql
-- Disable RLS (TEST ONLY - do not leave disabled in production)
ALTER TABLE public.car_listings DISABLE ROW LEVEL SECURITY;
```

Try publishing again. If it works, the issue is likely the **INSERT policy**:
`WITH CHECK (auth.uid() = user_id)`. Ensure the Supabase client has a valid session (e.g. `supabase.auth.getSession()`) and that `user_id` in the payload equals `auth.uid()`.

Re-enable RLS after testing:

```sql
ALTER TABLE public.car_listings ENABLE ROW LEVEL SECURITY;
```

## 2. Verify INSERT policy

The policy **"Authenticated users can create their own listings"** must allow your insert:

```sql
-- Inspect existing policies
SELECT * FROM pg_policies WHERE tablename = 'car_listings';
```

Policy should be:
- `FOR INSERT` with `WITH CHECK (auth.uid() = user_id)`.

## 3. Triggers (INSERT path)

`car_listings` has no `BEFORE INSERT` or `AFTER INSERT` triggers. Only:

- `trigger_car_listings_updated_at` → `BEFORE UPDATE` only
- `trigger_car_listings_sold_at` → `BEFORE UPDATE` when `is_sold` changes

So triggers should not affect INSERT. If you added custom triggers, check them.

## 4. Foreign key: user_id → auth.users(id)

If `user_id` is not in `auth.users`, the FK will fail. It normally returns an error, not a hang. To confirm the inserting user exists:

```sql
SELECT id FROM auth.users WHERE id = '<your-user-uuid>';
```

## 5. Minimal test insert (run in SQL Editor as authenticated user)

Run as the same role PostgREST uses (or temporarily as superuser to rule out RLS):

```sql
-- Replace <your-user-id> with auth.uid() or a real auth.users.id
INSERT INTO public.car_listings (
  user_id, title, make, model, year, price, mileage,
  transmission, fuel_type, condition, location, status, is_sold
) VALUES (
  '<your-user-id>',
  'Test Car',
  'Toyota',
  'Camry',
  2020,
  25000,
  50000,
  'automatic',
  'petrol',
  'good',
  'Baghdad, Iraq',
  'active',
  false
)
RETURNING id;
```

If this also hangs, the cause is in the DB (locks, constraints, extensions). If it works, the problem is in the client (auth session, payload, or PostgREST).
