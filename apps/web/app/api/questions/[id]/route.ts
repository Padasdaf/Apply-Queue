import { answerQuestionSchema } from "@applyqueue/shared";
import { apiError } from "@/lib/server/errors";
import { getSupabaseAdmin } from "@/lib/server/supabase";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { answer } = answerQuestionSchema.parse(await request.json());
    const { error } = await getSupabaseAdmin()
      .from("application_questions")
      .update({ answer, status: "ANSWERED_BY_USER" })
      .eq("id", id);
    if (error) throw error;
    return Response.json({ saved: true });
  } catch (error) {
    return apiError(error);
  }
}
