import { createClient } from '@supabase/supabase-js'

export function createSupabaseClient() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pqtpzsyjfbgboqermdfg.supabase.co'
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()

  if (!supabaseAnonKey) {
    throw new Error('Falta configurar la clave pública de Supabase.')
  }

  return createClient(supabaseUrl, supabaseAnonKey)
}