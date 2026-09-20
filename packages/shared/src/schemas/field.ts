import { z } from "zod/v4";
import { SEMANTIC_FIELD_TYPES } from "../constants/index.js";

export const applicationFieldTypeSchema = z.enum([
  "text",
  "textarea",
  "email",
  "phone",
  "select",
  "radio",
  "checkbox",
  "file",
  "unknown",
]);

export const applicationFieldSchema = z.object({
  identifier: z.string().min(1),
  label: z.string().min(1),
  selector: z.string().min(1),
  type: applicationFieldTypeSchema,
  inputType: z.string().optional(),
  name: z.string().optional(),
  autocomplete: z.string().optional(),
  context: z.string().optional(),
  required: z.boolean(),
  options: z.array(z.string()).optional(),
  optionValues: z.record(z.string(), z.string()).optional(),
  optionSelectors: z.record(z.string(), z.string()).optional(),
});

export const semanticFieldTypeSchema = z.enum(SEMANTIC_FIELD_TYPES);

export const fieldDecisionSchema = z.object({
  fieldIdentifier: z.string(),
  semanticType: semanticFieldTypeSchema,
  action: z.enum(["PROFILE_LOOKUP", "GENERATE", "ASK_USER", "SKIP"]),
  profileField: z.string().nullable(),
  value: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  reason: z.string(),
});

export const fieldDecisionListSchema = z.object({ decisions: z.array(fieldDecisionSchema) });

export type ApplicationField = z.infer<typeof applicationFieldSchema>;
export type SemanticFieldType = z.infer<typeof semanticFieldTypeSchema>;
export type FieldDecision = z.infer<typeof fieldDecisionSchema>;
