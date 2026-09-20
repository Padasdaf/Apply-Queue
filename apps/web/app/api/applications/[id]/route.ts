import { applicationEventSchema, applicationQuestionSchema, applicationSchema } from "@applyqueue/shared";
import { apiError } from "@/lib/server/errors";
import { getSupabaseAdmin } from "@/lib/server/supabase";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const db = getSupabaseAdmin();
    const [applicationResult, eventsResult, questionsResult] = await Promise.all([
      db.from("applications").select("*").eq("id", id).single(),
      db.from("application_events").select("*").eq("application_id", id).order("created_at"),
      db.from("application_questions").select("*").eq("application_id", id).order("created_at"),
    ]);
    if (applicationResult.error) throw applicationResult.error;
    if (eventsResult.error) throw eventsResult.error;
    if (questionsResult.error) throw questionsResult.error;
    return Response.json({
      application: applicationSchema.parse(applicationResult.data),
      events: applicationEventSchema.array().parse(eventsResult.data),
      questions: applicationQuestionSchema.array().parse(questionsResult.data),
    });
  } catch (error) {
    return apiError(error);
  }
}
