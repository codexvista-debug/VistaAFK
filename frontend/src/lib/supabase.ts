import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vbzzvnpkewllqqdtxmie.supabase.co';
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZienp2bnBrZXdsbHFxZHR4bWllIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MTMzNzM1MSwiZXhwIjoyMTA2OTEzMzUxfQ.95sEs7eGI_hZh1sBlb3-kNWexRcpEXOgOPCJe3-o2X0';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
