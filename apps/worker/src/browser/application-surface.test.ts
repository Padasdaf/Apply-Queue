import { describe, expect, it } from "vitest";
import type { SnapshotResult } from "@browserbasehq/stagehand";
import { analyzeApplicationSnapshot } from "./application-surface.js";

const pageUrl = "https://jobs.ashbyhq.com/example/job/application";

function snapshot(formattedTree: string, xpathMap: Record<string, string>): SnapshotResult {
  return { formattedTree, xpathMap, urlMap: {} };
}

describe("snapshot application surface detection", () => {
  it("detects top-level fields", () => {
    const probe = analyzeApplicationSnapshot(snapshot(
      "[1-10] textbox: Email Address",
      { "1-10": "/html/body/form/input" },
    ), pageUrl);
    expect(probe).toMatchObject({
      hasApplicationControls: true,
      controlCount: 1,
      iframeContentPresent: false,
      surface: { kind: "PAGE", url: pageUrl },
    });
  });

  it("detects fields contained in an iframe", () => {
    const probe = analyzeApplicationSnapshot(snapshot([
      "[1-1] Iframe: Application",
      "  [2-10] textbox: Email Address",
      "  [2-11] button: Upload Resume",
    ].join("\n"), {
      "1-1": "/html/body/iframe",
      "2-10": "/html/body/iframe/html/body/form/input[1]",
      "2-11": "/html/body/iframe/html/body/form/input[2]",
    }), pageUrl);
    expect(probe).toMatchObject({
      hasApplicationControls: true,
      controlCount: 2,
      iframeContentPresent: true,
      surface: { kind: "FRAME", xpathPrefix: "/html/body/iframe", index: 0 },
    });
  });

  it("returns no application surface when the snapshot has no meaningful controls", () => {
    const probe = analyzeApplicationSnapshot(snapshot(
      "[1-1] heading: Software Engineer\n[1-2] paragraph: Job description",
      { "1-1": "/html/body/h1", "1-2": "/html/body/p" },
    ), pageUrl);
    expect(probe.hasApplicationControls).toBe(false);
    expect(probe.controlCount).toBe(0);
    expect(probe.surface).toBeNull();
  });
});
