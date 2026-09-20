import { DEMO_PROFILE_ID, profileDocumentSchema } from "@applyqueue/shared";
import { apiError } from "@/lib/server/errors";
import { getSupabaseAdmin } from "@/lib/server/supabase";

export async function GET() {
  try {
    const { data, error } = await getSupabaseAdmin().from("documents").select("*")
      .eq("profile_id", DEMO_PROFILE_ID).order("created_at", { ascending: false });
    if (error) throw error;
    return Response.json({ documents: profileDocumentSchema.array().parse(data) });
  } catch (error) {
    return apiError(error);
  }
}
