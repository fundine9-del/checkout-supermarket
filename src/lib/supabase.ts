import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
// Also accepts the typo'd key name in case it came from the checkout server's .env
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ??
  import.meta.env.VITE_SUPABASE_ANNON_KEY) as string | undefined

if (!url || !anonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in the webapp .env (see .env.example)',
  )
}

export const supabase = createClient(url, anonKey)