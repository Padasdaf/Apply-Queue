import {
  applicantProfileBundleSchema,
  applicantProfileSchema,
  DEMO_PROFILE_ID,
  profileDocumentSchema,
  profileEducationSchema,
  profileEmploymentSchema,
  profileLinkSchema,
  type ApplicantProfileBundle,
} from "@applyqueue/shared";
import { getSupabaseAdmin } from "./supabase";

export async function getApplicantProfileBundle(): Promise<ApplicantProfileBundle> {
  const db = getSupabaseAdmin();
  const [profileResult, educationsResult, employmentsResult, linksResult, documentsResult] = await Promise.all([
    db.from("profiles").select("*").eq("id", DEMO_PROFILE_ID).single(),
    db.from("profile_educations").select("*").eq("profile_id", DEMO_PROFILE_ID).order("created_at"),
    db.from("profile_employments").select("*").eq("profile_id", DEMO_PROFILE_ID).order("created_at"),
    db.from("profile_links").select("*").eq("profile_id", DEMO_PROFILE_ID).order("created_at"),
    db.from("documents").select("*").eq("profile_id", DEMO_PROFILE_ID).order("created_at", { ascending: false }),
  ]);

  if (profileResult.error) throw profileResult.error;
  if (educationsResult.error) throw educationsResult.error;
  if (employmentsResult.error) throw employmentsResult.error;
  if (linksResult.error) throw linksResult.error;
  if (documentsResult.error) throw documentsResult.error;

  return applicantProfileBundleSchema.parse({
    profile: applicantProfileSchema.parse(profileResult.data),
    educations: profileEducationSchema.array().parse(educationsResult.data),
    employments: profileEmploymentSchema.array().parse(employmentsResult.data),
    links: profileLinkSchema.array().parse(linksResult.data),
    documents: profileDocumentSchema.array().parse(documentsResult.data),
  });
}
