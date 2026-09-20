import { config } from "dotenv";
import { resolve } from "node:path";
import { z } from "zod/v4";

config({ path: resolve(import.meta.dirname, "../../../.env"), quiet: true });

const envSchema = z.object({
  BROWSERBASE_API_KEY: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_MODEL: z.string().min(1).default("gpt-5-mini"),
  SUPABASE_URL: z.url(),
  SUPABASE_SECRET_KEY: z.string().min(1),
  WORKER_POLL_INTERVAL_MS: z.coerce.number().int().min(500).default(2000),
});

export const env = envSchema.parse(process.env);
