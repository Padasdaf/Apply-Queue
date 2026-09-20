import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import {
  fieldDecisionListSchema,
  type ApplicantProfileBundle,
  type ApplicationField,
  type FieldDecision,
} from "@applyqueue/shared";
import { env } from "../env.js";
import { resolveDeterministicFields } from "./deterministic.js";
import { safeApplicantContext } from "../profile/field-resolution.js";

const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

export async function resolveFields(fields: ApplicationField[], bundle: ApplicantProfileBundle): Promise<FieldDecision[]> {
  const { decisions, unresolved } = resolveDeterministicFields(fields, bundle);
  if (unresolved.length === 0) return decisions;

  const safeContext = safeApplicantContext(bundle);

  try {
    const response = await client.responses.parse({
      model: env.OPENAI_MODEL,
      store: false,
      input: [
        {
          role: "system",
          content:
            "Classify unresolved job application fields. Never invent applicant facts. PROFILE_LOOKUP values must appear verbatim in the supplied context. Use ASK_USER for required, subjective, sensitive, or uncertain questions. Use SKIP for optional fields without a safe answer. GENERATE only for an open-ended text field when the supplied biography or experience is enough, and do not add claims, dates, employers, skills, or preferences that are not present.",
        },
        {
          role: "user",
          content: JSON.stringify({ fields: unresolved, safeApplicantContext: safeContext }),
        },
      ],
      text: { format: zodTextFormat(fieldDecisionListSchema, "field_decisions") },
    });

    const parsed = response.output_parsed;
    if (!parsed) throw new Error("OpenAI returned no structured field decisions.");
    const validated = fieldDecisionListSchema.parse(parsed);
    const unresolvedIds = new Set(unresolved.map((field) => field.identifier));
    const fieldsById = new Map(unresolved.map((field) => [field.identifier, field]));
    const knownValues = collectKnownValues(safeContext);
    knownValues.add(normalizeKnownValue(`${bundle.profile.first_name} ${bundle.profile.last_name}`));
    const modelDecisions = validated.decisions
      .filter((decision) => unresolvedIds.has(decision.fieldIdentifier))
      .map((decision) => {
        const field = fieldsById.get(decision.fieldIdentifier);
        if (!field) return decision;
        if (decision.action === "PROFILE_LOOKUP" && (!decision.value || !knownValues.has(normalizeKnownValue(decision.value)))) {
          return unansweredDecision(field, "The proposed profile value was not present in the supplied profile context.");
        }
        if (decision.action === "GENERATE" && !["text", "textarea"].includes(field.type)) {
          return unansweredDecision(field, "Generated answers are only allowed for text fields.");
        }
        return decision;
      });

    for (const field of unresolved) {
      if (!modelDecisions.some((decision) => decision.fieldIdentifier === field.identifier)) {
        modelDecisions.push(unansweredDecision(field, "The model did not return a decision for this field."));
      }
    }
    return [...decisions, ...modelDecisions];
  } catch (error) {
    console.warn("OpenAI field fallback failed; unresolved fields will require user input.", error);
    return [
      ...decisions,
      ...unresolved.map((field) => unansweredDecision(field, "Structured field reasoning was unavailable.")),
    ];
  }
}

function normalizeKnownValue(value: string): string {
  return value.trim().toLowerCase();
}

function collectKnownValues(value: unknown, result = new Set<string>()): Set<string> {
  if (typeof value === "string" && value.trim()) result.add(normalizeKnownValue(value));
  else if (typeof value === "boolean") result.add(value ? "yes" : "no");
  else if (Array.isArray(value)) value.forEach((item) => collectKnownValues(item, result));
  else if (value && typeof value === "object") Object.values(value).forEach((item) => collectKnownValues(item, result));
  return result;
}

function unansweredDecision(field: ApplicationField, reason: string): FieldDecision {
  return {
    fieldIdentifier: field.identifier,
    semanticType: "UNKNOWN",
    action: field.required ? "ASK_USER" : "SKIP",
    profileField: null,
    value: null,
    confidence: 0,
    reason,
  };
}
