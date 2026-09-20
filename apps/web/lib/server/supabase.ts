import { createClient } from "@supabase/supabase-js";
import { getServerEnv } from "./env";

export function getSupabaseAdmin() {
  const env = getServerEnv();
  return createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
