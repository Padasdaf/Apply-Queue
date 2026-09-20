import type { ApplicantProfileBundle, ApplicationField, FieldDecision } from "@applyqueue/shared";
import { classifySemanticField, resolveProfileValue } from "../profile/field-resolution.js";

export function deterministicDecision(
  field: ApplicationField,
  bundle: ApplicantProfileBundle,
): FieldDecision | null {
  const semanticType = classifySemanticField(field);

  if (field.type === "file" && semanticType !== "RESUME") {
    return {
      fieldIdentifier: field.identifier,
      semanticType: "UNKNOWN",
      action: field.required ? "ASK_USER" : "SKIP",
      profileField: null,
      value: null,
      confidence: 1,
      reason: "Only primary resume uploads are handled automatically.",
    };
  }
  if (!semanticType) return null;

  const resolved = resolveProfileValue(semanticType, field, bundle);
  return {
    fieldIdentifier: field.identifier,
    semanticType,
    action: resolved.value ? "PROFILE_LOOKUP" : field.required ? "ASK_USER" : "SKIP",
    profileField: resolved.profileField || null,
    value: resolved.value,
    confidence: 0.99,
    reason: resolved.value
      ? "Matched structured applicant profile data."
      : "The matching applicant profile value is not explicitly set.",
  };
}

export function resolveDeterministicFields(
  fields: ApplicationField[],
  bundle: ApplicantProfileBundle,
): { decisions: FieldDecision[]; unresolved: ApplicationField[] } {
  const decisions: FieldDecision[] = [];
  const unresolved: ApplicationField[] = [];
  const seenStructuredTypes = new Set<string>();
  const repeatSensitive = /^(SCHOOL|DEGREE|FIELD_OF_STUDY|EDUCATION_|EMPLOYER|JOB_TITLE|EMPLOYMENT_|CURRENT_EMPLOYMENT)/;
  for (const field of fields) {
    const decision = deterministicDecision(field, bundle);
    if (decision && repeatSensitive.test(decision.semanticType) && seenStructuredTypes.has(decision.semanticType)) {
      decisions.push({
        fieldIdentifier: field.identifier,
        semanticType: decision.semanticType,
        action: field.required ? "ASK_USER" : "SKIP",
        profileField: null,
        value: null,
        confidence: 1,
        reason: "A repeated structured section cannot be matched to a specific profile entry safely.",
      });
    } else if (decision) {
      decisions.push(decision);
      if (repeatSensitive.test(decision.semanticType)) seenStructuredTypes.add(decision.semanticType);
    }
    else unresolved.push(field);
  }
  return { decisions, unresolved };
}
