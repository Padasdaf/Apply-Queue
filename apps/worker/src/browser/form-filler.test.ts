import { describe, expect, it, vi } from "vitest";
import type { ApplicationField, FieldDecision } from "@applyqueue/shared";
import type { Page } from "@browserbasehq/stagehand";
import { fillField, findMatchingOption } from "./form-filler.js";

const selectField: ApplicationField = {
  identifier: "country",
  label: "Country",
  selector: "#country",
  type: "select",
  required: true,
  options: ["Select…", "Canada", "United States of America"],
};

describe("deterministic option matching", () => {
  it("matches an exact ATS option label", () => {
    expect(findMatchingOption(selectField, "Canada")).toBe("Canada");
  });

  it("matches explicit yes/no values without guessing other choices", () => {
    const field = { ...selectField, options: ["Please select", "Yes", "No"] };
    expect(findMatchingOption(field, "No")).toBe("No");
  });

  it("fills through the selected iframe surface", async () => {
    const fill = vi.fn().mockResolvedValue(undefined);
    const locator = vi.fn(() => ({ fill }));
    const page = { locator } as unknown as Page;
    const field: ApplicationField = {
      ...selectField,
      selector: "xpath=/html/body/iframe/html/body/form/input",
      type: "email",
    };
    const decision: FieldDecision = {
      fieldIdentifier: "country",
      semanticType: "EMAIL",
      action: "PROFILE_LOOKUP",
      profileField: "profile.email",
      value: "applicant@example.com",
      confidence: 1,
      reason: "Explicit profile value",
    };
    await fillField(page, field, decision, {
      kind: "FRAME",
      url: "https://embedded.example/application",
      name: "Application",
      xpathPrefix: "/html/body/iframe",
      index: 0,
    });

    expect(locator).toHaveBeenCalledWith("xpath=/html/body/iframe/html/body/form/input");
    expect(fill).toHaveBeenCalledWith("applicant@example.com");
  });
});
