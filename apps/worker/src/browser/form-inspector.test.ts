import { describe, expect, it } from "vitest";
import type { ApplicationField } from "@applyqueue/shared";
import type { Page, SnapshotResult } from "@browserbasehq/stagehand";
import { hasMeaningfulApplicationFields, inspectSnapshotFields, normalizeInspectedControls } from "./form-inspector.js";

function field(label: string, inputType = "text"): ApplicationField {
  return { identifier: label, label, selector: "#field", type: "text", inputType, required: false };
}

describe("application form detection", () => {
  it("ignores a lone job-board search input", () => {
    expect(hasMeaningfulApplicationFields([field("Search jobs", "search")])).toBe(false);
  });

  it("recognizes identity fields as an application form", () => {
    expect(hasMeaningfulApplicationFields([field("Email address", "email")])).toBe(true);
  });

  it("normalizes a plain-JSON control probe and groups radio options", () => {
    const raw = [
      {
        index: 0, marker: "field-0", tag: "input", inputType: "email", id: "email", name: "email",
        autocomplete: "email", label: "Email", context: "Contact", required: true, options: [],
      },
      {
        index: 1, marker: "field-1", tag: "input", inputType: "radio", id: "auth-yes", name: "authorized",
        autocomplete: "", label: "Yes", context: "Authorized to work?", required: true,
        options: [{ label: "Yes", value: "yes" }],
      },
      {
        index: 2, marker: "field-2", tag: "input", inputType: "radio", id: "auth-no", name: "authorized",
        autocomplete: "", label: "No", context: "Authorized to work?", required: true,
        options: [{ label: "No", value: "no" }],
      },
    ];

    expect(JSON.parse(JSON.stringify(raw))).toEqual(raw);
    const fields = normalizeInspectedControls(raw);
    expect(fields).toHaveLength(2);
    expect(fields[0]).toMatchObject({ label: "Email", type: "email", required: true });
    expect(fields[1]).toMatchObject({
      label: "Authorized to work?",
      type: "radio",
      options: ["Yes", "No"],
      optionValues: { Yes: "yes", No: "no" },
    });
  });

  it("extracts fields from the selected iframe snapshot only", async () => {
    const snapshot: SnapshotResult = {
      formattedTree: [
        "[1-1] Iframe: Application",
        "  [2-10] textbox: Email Address *",
        "  [2-11] button: Upload Resume",
        "[1-20] textbox: Search jobs",
      ].join("\n"),
      xpathMap: {
        "1-1": "/html/body/iframe",
        "2-10": "/html/body/iframe/html/body/form/input[1]",
        "2-11": "/html/body/iframe/html/body/form/input[2]",
        "1-20": "/html/body/input",
      },
      urlMap: {},
    };
    const page = { locator: () => ({ innerHtml: async () => "" }) } as unknown as Page;
    const fields = await inspectSnapshotFields(page, snapshot, {
      kind: "FRAME",
      url: "https://embedded.example/application",
      name: "Application",
      xpathPrefix: "/html/body/iframe",
      index: 0,
    });

    expect(fields).toHaveLength(2);
    expect(fields.map(({ label, type }) => ({ label, type }))).toEqual([
      { label: "Email Address *", type: "email" },
      { label: "Upload Resume", type: "file" },
    ]);
    expect(fields.every((item) => item.selector.startsWith("xpath=/html/body/iframe/"))).toBe(true);
  });
});
