import { createClient } from '@supabase/supabase-js'

// Obtiene las variables de entorno o de localStorage si se configuraron en la UI
const envUrl = import.meta.env.VITE_SUPABASE_URL
const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const localUrl = typeof window !== 'undefined' ? localStorage.getItem('SPASALON_SUPABASE_URL') : null
const localKey = typeof window !== 'undefined' ? localStorage.getItem('SPASALON_SUPABASE_KEY') : null

const effectiveUrl = (envUrl && envUrl.startsWith('http') && !envUrl.includes('example.com')) 
  ? envUrl 
  : (localUrl && localUrl.startsWith('http') ? localUrl : 'https://demo-spasalon.supabase.co')

const effectiveKey = (envKey && envKey.length > 20 && !envKey.includes('tu-anon-key')) 
  ? envKey 
  : (localKey && localKey.length > 20 ? localKey : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy-demo-token-for-spasalon')

export const isSupabaseConfigured = () => {
  const url = (envUrl && envUrl.startsWith('http') && !envUrl.includes('example.com')) || (localUrl && localUrl.startsWith('http'))
  const key = (envKey && envKey.length > 20 && !envKey.includes('tu-anon-key')) || (localKey && localKey.length > 20)
  return Boolean(url && key)
}

export const saveSupabaseCredentials = (url, key) => {
  if (typeof window !== 'undefined') {
    if (url) localStorage.setItem('SPASALON_SUPABASE_URL', url.trim())
    else localStorage.removeItem('SPASALON_SUPABASE_URL')

    if (key) localStorage.setItem('SPASALON_SUPABASE_KEY', key.trim())
    else localStorage.removeItem('SPASALON_SUPABASE_KEY')
  }
}

export const getStoredCredentials = () => ({
  url: localUrl || envUrl || '',
  key: localKey || envKey || ''
})

export const supabase = createClient(effectiveUrl, effectiveKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true
  }
})
