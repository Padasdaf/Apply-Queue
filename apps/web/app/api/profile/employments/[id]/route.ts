import { DEMO_PROFILE_ID, profileEmploymentPatchSchema, profileEmploymentSchema } from "@applyqueue/shared";
import { z } from "zod/v4";
import { apiError } from "@/lib/server/errors";
import { getSupabaseAdmin } from "@/lib/server/supabase";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const id = z.uuid().parse((await context.params).id);
    const input = profileEmploymentPatchSchema.parse(await request.json());
    const { data, error } = await getSupabaseAdmin().from("profile_employments").update(input)
      .eq("id", id).eq("profile_id", DEMO_PROFILE_ID).select("*").single();
    if (error) throw error;
    return Response.json({ employment: profileEmploymentSchema.parse(data) });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const id = z.uuid().parse((await context.params).id);
    const { error } = await getSupabaseAdmin().from("profile_employments").delete()
      .eq("id", id).eq("profile_id", DEMO_PROFILE_ID);
    if (error) throw error;
    return Response.json({ deleted: true });
  } catch (error) {
    return apiError(error);
  }
}
