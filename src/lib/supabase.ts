import { createClient } from '@supabase/supabase-js'
import { env } from '@/http/env'

const supabaseUrl = env.PUBLIC_SUPABASE_URL as string
const supabaseServiceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY as string

// Client admin (secret/service_role) — ignora o RLS. USO EXCLUSIVO NO BACKEND, nunca expor no front/app
export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})
