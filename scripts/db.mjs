import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required. Add them as GitHub Actions secrets; never commit them.');
}

export const db = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});
