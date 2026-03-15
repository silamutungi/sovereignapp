import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env')
}

export const supabase = createClient(supabaseUrl, supabaseKey)

export async function joinWaitlist(email: string, source = 'landing'): Promise<{ error: string | null }> {
  const { error } = await supabase.from('waitlist').insert([{ email, source }])
  if (error) {
    if (error.code === '23505') return { error: null }
    return { error: error.message }
  }
  return { error: null }
}
