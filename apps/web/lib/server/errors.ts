import { ZodError } from "zod/v4";

export function apiError(error: unknown) {
  console.error(error);
  if (error instanceof ZodError) {
    return Response.json({ error: error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }
  const message = error instanceof Error ? error.message : "Unexpected server error";
  return Response.json({ error: message }, { status: 500 });
}
