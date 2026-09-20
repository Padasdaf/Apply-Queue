import {
  applicantProfilePatchSchema,
  applicantProfileSchema,
  calculateProfileCompleteness,
  DEMO_PROFILE_ID,
} from "@applyqueue/shared";
import { apiError } from "@/lib/server/errors";
import { getApplicantProfileBundle } from "@/lib/server/profile";
import { getSupabaseAdmin } from "@/lib/server/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const bundle = await getApplicantProfileBundle();
    return Response.json({ ...bundle, completeness: calculateProfileCompleteness(bundle) });
  } catch (error) {
    return apiError(error);
  }
}

async function updateProfile(request: Request) {
  try {
    const input = applicantProfilePatchSchema.parse(await request.json());
    const { data, error } = await getSupabaseAdmin()
      .from("profiles")
      .update(input)
      .eq("id", DEMO_PROFILE_ID)
      .select("*")
      .single();
    if (error) throw error;
    return Response.json({ profile: applicantProfileSchema.parse(data) });
  } catch (error) {
    return apiError(error);
  }
}

export const PATCH = updateProfile;
export const PUT = updateProfile;
