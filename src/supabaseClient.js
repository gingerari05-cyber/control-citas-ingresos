import { createClient } from '@supabase/supabase-js'

const envUrl = import.meta.env.VITE_SUPABASE_URL
const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = () => {
  return Boolean(envUrl && envUrl.startsWith('http') && envKey && envKey.length > 20)
}

export const supabase = isSupabaseConfigured()
  ? createClient(envUrl, envKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true
  }
})
  : null

if (!isSupabaseConfigured()) {
  console.warn('Supabase no está configurado. Define VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env.')
}
