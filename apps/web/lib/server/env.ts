import { z } from "zod/v4";

const serverEnvSchema = z.object({
  SUPABASE_URL: z.url(),
  SUPABASE_SECRET_KEY: z.string().min(1),
});

export function getServerEnv() {
  return serverEnvSchema.parse(process.env);
}
