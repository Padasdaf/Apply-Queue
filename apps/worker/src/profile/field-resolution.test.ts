import { describe, expect, it } from "vitest";
import type { ApplicationField } from "@applyqueue/shared";
import { makeProfileBundle } from "../test/profile-fixture.js";
import { classifySemanticField, resolveProfileValue } from "./field-resolution.js";

function field(label: string, extra: Partial<ApplicationField> = {}): ApplicationField {
  return { identifier: label, label, selector: "#field", type: "text", required: true, ...extra };
}

describe("semantic ATS field matching", () => {
  it("does not let broad surrounding context override a direct field label", () => {
    const email = field("Email", { context: "First name Last name Email Phone Resume" });
    expect(classifySemanticField(email)).toBe("EMAIL");
  });

  it("uses section context to distinguish education and employment dates", () => {
    expect(classifySemanticField(field("End year", { context: "Education history" }))).toBe("EDUCATION_END_YEAR");
    expect(classifySemanticField(field("End year", { context: "Employment history" }))).toBe("EMPLOYMENT_END_YEAR");
  });

  it("resolves normalized links before legacy scalar links", () => {
    const bundle = makeProfileBundle();
    bundle.profile.linkedin_url = "https://linkedin.com/in/legacy";
    const result = resolveProfileValue("LINKEDIN", field("LinkedIn"), bundle);
    expect(result.value).toBe("https://linkedin.com/in/ada");
  });
});
