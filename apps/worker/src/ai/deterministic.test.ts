import { describe, expect, it } from "vitest";
import type { ApplicationField } from "@applyqueue/shared";
import { makeProfileBundle } from "../test/profile-fixture.js";
import { deterministicDecision, resolveDeterministicFields } from "./deterministic.js";

function field(label: string, required = true, extra: Partial<ApplicationField> = {}): ApplicationField {
  return {
    identifier: label.toLowerCase().replaceAll(" ", "_"),
    label,
    selector: "#field",
    type: "text",
    required,
    ...extra,
  };
}

describe("deterministic rich-profile field decisions", () => {
  it("maps obvious identity fields without OpenAI", () => {
    expect(deterministicDecision(field("First name"), makeProfileBundle())).toMatchObject({
      action: "PROFILE_LOOKUP",
      semanticType: "FIRST_NAME",
      value: "Ada",
    });
    expect(deterministicDecision(field("Email address"), makeProfileBundle())?.value).toBe("ada@example.com");
  });

  it("maps the primary education and employment entries", () => {
    const bundle = makeProfileBundle();
    expect(deterministicDecision(field("School", true, { context: "Education" }), bundle)?.value)
      .toBe("University of Waterloo");
    expect(deterministicDecision(field("Field of study", true, { context: "Education" }), bundle)?.value)
      .toBe("Computer Science");
    expect(deterministicDecision(field("Employer", true, { context: "Work Experience" }), bundle)?.value)
      .toBe("Analytical Engines");
    expect(deterministicDecision(field("Position title", true, { context: "Work Experience" }), bundle)?.value)
      .toBe("Software Engineering Intern");
  });

  it("maps structured month and year fields from semantic context", () => {
    const bundle = makeProfileBundle();
    expect(deterministicDecision(field("Start month", true, { type: "select", context: "Education history" }), bundle))
      .toMatchObject({ semanticType: "EDUCATION_START_MONTH", value: "September" });
    expect(deterministicDecision(field("Start year", true, { context: "Employment history" }), bundle))
      .toMatchObject({ semanticType: "EMPLOYMENT_START_YEAR", value: "2026" });
  });

  it("only answers authorization facts that were explicitly saved", () => {
    const bundle = makeProfileBundle();
    expect(deterministicDecision(field("Are you legally authorized to work in Canada?", true, { type: "radio" }), bundle)?.value)
      .toBe("Yes");
    expect(deterministicDecision(field("Will you require sponsorship?", true, { type: "radio" }), bundle)?.value)
      .toBe("No");

    bundle.profile.work_authorization = null;
    bundle.profile.requires_sponsorship = null;
    expect(deterministicDecision(field("Are you legally authorized to work in Canada?"), bundle)?.action).toBe("ASK_USER");
    expect(deterministicDecision(field("Will you require sponsorship?"), bundle)?.action).toBe("ASK_USER");
  });

  it("resolves the stored primary resume but not unrelated file inputs", () => {
    const bundle = makeProfileBundle();
    expect(deterministicDecision(field("Resume / CV", true, { type: "file" }), bundle)).toMatchObject({
      semanticType: "RESUME",
      action: "PROFILE_LOOKUP",
      value: "ada-resume.pdf",
    });
    expect(deterministicDecision(field("Cover letter", false, { type: "file" }), bundle)?.action).toBe("SKIP");
  });

  it("leaves custom questions for structured OpenAI reasoning", () => {
    const result = resolveDeterministicFields([field("Why do you want to join us?")], makeProfileBundle());
    expect(result.decisions).toHaveLength(0);
    expect(result.unresolved).toHaveLength(1);
  });

  it("does not duplicate one profile entry across repeated ATS sections", () => {
    const fields = [
      field("Employer", true, { identifier: "employer-1", context: "Work Experience 1" }),
      field("Employer", true, { identifier: "employer-2", context: "Work Experience 2" }),
    ];
    const result = resolveDeterministicFields(fields, makeProfileBundle());
    expect(result.decisions[0]?.value).toBe("Analytical Engines");
    expect(result.decisions[1]).toMatchObject({ action: "ASK_USER", value: null });
  });
});
