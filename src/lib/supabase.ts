import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseKey) {
  console.warn('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — waitlist submissions will fail')
}

export const supabase = createClient(
  supabaseUrl ?? 'https://placeholder.supabase.co',
  supabaseKey ?? 'placeholder'
)

// Required Supabase RLS policy — run once in the SQL editor:
//
//   CREATE POLICY "Allow anonymous inserts" ON waitlist
//   FOR INSERT TO anon
//   WITH CHECK (true);
//
// Without this, anon-key inserts fail with "row-level security policy" error.
export async function joinWaitlist(email: string, source = 'landing'): Promise<{ error: string | null }> {
  const { error } = await supabase.from('waitlist').insert([{ email, source }])
  if (error) {
    if (error.code === '23505') return { error: null }
    return { error: error.message }
  }
  return { error: null }
}
