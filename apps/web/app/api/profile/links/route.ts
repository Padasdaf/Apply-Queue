import { DEMO_PROFILE_ID, profileLinkInputSchema, profileLinkSchema } from "@applyqueue/shared";
import { apiError } from "@/lib/server/errors";
import { getSupabaseAdmin } from "@/lib/server/supabase";

export async function GET() {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("profile_links").select("*").eq("profile_id", DEMO_PROFILE_ID).order("created_at");
    if (error) throw error;
    return Response.json({ links: profileLinkSchema.array().parse(data) });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const input = profileLinkInputSchema.parse(await request.json());
    const { data, error } = await getSupabaseAdmin()
      .from("profile_links").insert({ profile_id: DEMO_PROFILE_ID, ...input }).select("*").single();
    if (error) throw error;
    return Response.json({ link: profileLinkSchema.parse(data) }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
