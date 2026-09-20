import { z } from "zod/v4";
import { APPLICATION_EVENT_TYPES, APPLICATION_STATUSES } from "../constants/index.js";
import { postgresTimestampSchema } from "./common.js";

export const applicationStatusSchema = z.enum(APPLICATION_STATUSES);
export const applicationEventTypeSchema = z.enum(APPLICATION_EVENT_TYPES);

export const applicationSchema = z.object({
  id: z.uuid(),
  url: z.url(),
  company: z.string().nullable(),
  role: z.string().nullable(),
  status: applicationStatusSchema,
  progress: z.number().int().min(0).max(100),
  browserbase_session_id: z.string().nullable(),
  browserbase_session_url: z.url().nullable(),
  error_message: z.string().nullable(),
  processing_requested_at: postgresTimestampSchema.nullable(),
  created_at: postgresTimestampSchema,
  started_at: postgresTimestampSchema.nullable(),
  completed_at: postgresTimestampSchema.nullable(),
  updated_at: postgresTimestampSchema,
});

export const createApplicationSchema = z.object({
  url: z.url().refine((url) => ["http:", "https:"].includes(new URL(url).protocol), {
    message: "Job URL must use HTTP or HTTPS",
  }),
});

export const applicationEventSchema = z.object({
  id: z.uuid(),
  application_id: z.uuid(),
  event_type: applicationEventTypeSchema,
  message: z.string(),
  metadata: z.record(z.string(), z.unknown()),
  created_at: postgresTimestampSchema,
});

export const applicationQuestionStatusSchema = z.enum([
  "AUTO_ANSWERED",
  "NEEDS_INPUT",
  "ANSWERED_BY_USER",
]);

export const applicationQuestionSchema = z.object({
  id: z.uuid(),
  application_id: z.uuid(),
  field_identifier: z.string(),
  question: z.string(),
  answer: z.string().nullable(),
  confidence: z.number().min(0).max(1).nullable(),
  status: applicationQuestionStatusSchema,
  metadata: z.record(z.string(), z.unknown()),
  created_at: postgresTimestampSchema,
  updated_at: postgresTimestampSchema,
});

export const answerQuestionSchema = z.object({ answer: z.string().trim().min(1).max(5000) });

export type ApplicationStatus = z.infer<typeof applicationStatusSchema>;
export type ApplicationEventType = z.infer<typeof applicationEventTypeSchema>;
export type Application = z.infer<typeof applicationSchema>;
export type ApplicationEvent = z.infer<typeof applicationEventSchema>;
export type ApplicationQuestion = z.infer<typeof applicationQuestionSchema>;
