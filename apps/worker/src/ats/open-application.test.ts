import { describe, expect, it, vi } from "vitest";
import type { Page, Stagehand } from "@browserbasehq/stagehand";
import {
  isFinalSubmissionAction,
  isSafeApplicationEntryAction,
  openPrimaryApplicationForm,
} from "./open-application.js";

describe("application entry submission guard", () => {
  it.each([
    "Submit",
    "Submit Application",
    "Finish",
    "Finish application",
    "Send Application",
    "Confirm Submission",
    "Confirm application",
    "Complete application",
  ])("rejects final action text: %s", (text) => {
    expect(isFinalSubmissionAction(text)).toBe(true);
    expect(isSafeApplicationEntryAction(text)).toBe(false);
  });

  it.each(["Apply", "Apply now", "Apply for this job", "Start application"])(
    "allows only application-entry text: %s",
    (text) => {
      expect(isFinalSubmissionAction(text)).toBe(false);
      expect(isSafeApplicationEntryAction(text)).toBe(true);
    },
  );

  it("does not treat unrelated navigation as an application entry", () => {
    expect(isSafeApplicationEntryAction("Next")).toBe(false);
  });

  it("does not click a final target returned by semantic observation", async () => {
    const click = vi.fn();
    const locator = vi.fn((selector: string) => selector === "#primary-action"
      ? { textContent: vi.fn().mockResolvedValue("Submit Application"), click }
      : { first: () => ({ count: vi.fn().mockResolvedValue(0) }) });
    const page = {
      locator,
      evaluate: vi.fn().mockResolvedValue(false),
    } as unknown as Page;
    const stagehand = {
      observe: vi.fn().mockResolvedValue({
        data: [{ description: "Click Apply", selector: "#primary-action" }],
      }),
    } as unknown as Stagehand;

    await expect(openPrimaryApplicationForm(page, stagehand, "ASHBY")).rejects.toThrow(
      "No safe Apply button or link was found.",
    );
    expect(click).not.toHaveBeenCalled();
  });
});
