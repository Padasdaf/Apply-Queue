import { applicationSchema, createApplicationSchema, DEMO_PROFILE_ID } from "@applyqueue/shared";
import { apiError } from "@/lib/server/errors";
import { getSupabaseAdmin } from "@/lib/server/supabase";

export const dynamic = "force-dynamic";

function inferJob(urlString: string) {
  const url = new URL(urlString);
  const company = url.hostname.replace(/^www\./, "").split(".")[0]?.replace(/[-_]/g, " ") ?? "Unknown company";
  const pathParts = url.pathname.split("/").filter(Boolean);
  const role = decodeURIComponent(pathParts.at(-1) ?? "New application").replace(/[-_]/g, " ");
  return { company: company.replace(/\b\w/g, (letter) => letter.toUpperCase()), role };
}

export async function GET() {
  try {
    const { data, error } = await getSupabaseAdmin().from("applications").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return Response.json({ applications: applicationSchema.array().parse(data) });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const input = createApplicationSchema.parse(await request.json());
    const db = getSupabaseAdmin();

    // Reuse an eventless row left by the old response-validation bug. Also
    // treat a recently-created identical queued row as an idempotent retry: a
    // client can lose the successful response and retry the same request.
    const retryCutoff = Date.now() - 5 * 60 * 1000;
    const { data: queuedCandidates, error: candidateError } = await db
      .from("applications")
      .select("*")
      .eq("profile_id", DEMO_PROFILE_ID)
      .eq("url", input.url)
      .eq("status", "QUEUED")
      .is("processing_requested_at", null)
      .order("created_at", { ascending: true })
      .limit(20);
    if (candidateError) throw candidateError;

    for (const candidate of queuedCandidates ?? []) {
      const { count, error: eventLookupError } = await db
        .from("application_events")
        .select("id", { count: "exact", head: true })
        .eq("application_id", candidate.id)
        .eq("event_type", "APPLICATION_CREATED");
      if (eventLookupError) throw eventLookupError;
      if ((count ?? 0) > 0) {
        if (new Date(candidate.created_at).getTime() >= retryCutoff) {
          return Response.json({ application: applicationSchema.parse(candidate), recovered: true });
        }
        continue;
      }

      const application = applicationSchema.parse(candidate);
      const { error: recoveryEventError } = await db.from("application_events").insert({
        application_id: application.id,
        event_type: "APPLICATION_CREATED",
        message: "Application added to the queue.",
        metadata: { url: application.url, recoveredAfterValidationFailure: true },
      });
      if (recoveryEventError) throw recoveryEventError;
      return Response.json({ application, recovered: true });
    }

    const { data, error } = await db
      .from("applications")
      .insert({ profile_id: DEMO_PROFILE_ID, url: input.url, ...inferJob(input.url) })
      .select("*")
      .single();
    if (error) throw error;
    const application = applicationSchema.parse(data);
    const { error: eventError } = await db.from("application_events").insert({
      application_id: application.id,
      event_type: "APPLICATION_CREATED",
      message: "Application added to the queue.",
      metadata: { url: application.url },
    });
    if (eventError) throw eventError;
    return Response.json({ application }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
