import { apiError } from "@/lib/server/errors";
import { getSupabaseAdmin } from "@/lib/server/supabase";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { data, error } = await getSupabaseAdmin()
      .from("applications")
      .update({ processing_requested_at: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "QUEUED")
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) return Response.json({ error: "Only queued applications can be started." }, { status: 409 });
    return Response.json({ started: true });
  } catch (error) {
    return apiError(error);
  }
}
