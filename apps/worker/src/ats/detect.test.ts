import { describe, expect, it } from "vitest";
import { detectAts, isDirectApplicationPage } from "./detect.js";

describe("ATS detection", () => {
  it("detects public Greenhouse and Ashby job URLs", () => {
    expect(detectAts("https://job-boards.greenhouse.io/example/jobs/1234")).toBe("GREENHOUSE");
    expect(detectAts("https://jobs.ashbyhq.com/example/job-id")).toBe("ASHBY");
  });

  it("retains a generic fallback", () => {
    expect(detectAts("https://careers.example.com/jobs/1234")).toBe("GENERIC");
  });

  it("recognizes a direct Ashby application route", () => {
    const url = "https://jobs.ashbyhq.com/fable/3fd04c23-a63d-4b40-bfae-feafaa478caf/application";
    expect(isDirectApplicationPage(url, detectAts(url))).toBe(true);
    expect(isDirectApplicationPage("https://jobs.ashbyhq.com/fable/job-id", "ASHBY")).toBe(false);
  });
});
