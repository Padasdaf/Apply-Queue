import { describe, expect, it, vi } from "vitest";
import type { Page, SnapshotResult } from "@browserbasehq/stagehand";
import { waitForPostNavigationReadiness } from "./post-navigation.js";

const emptySnapshot: SnapshotResult = {
  formattedTree: "[1-1] heading: Application",
  xpathMap: { "1-1": "/html/body/h1" },
  urlMap: {},
};
const fieldSnapshot: SnapshotResult = {
  formattedTree: "[1-2] textbox: Email",
  xpathMap: { "1-2": "/html/body/form/input" },
  urlMap: {},
};

function mockPage(snapshots: Array<SnapshotResult | Error>, locatorCount: number | Error = 0): Page {
  let snapshotIndex = 0;
  return {
    url: vi.fn().mockResolvedValue("https://jobs.ashbyhq.com/example/job/application"),
    title: vi.fn().mockResolvedValue("Application"),
    snapshot: vi.fn(async () => {
      const result = snapshots[Math.min(snapshotIndex, snapshots.length - 1)]!;
      snapshotIndex += 1;
      if (result instanceof Error) throw result;
      return result;
    }),
    locator: vi.fn(() => ({
      count: vi.fn(async () => {
        if (locatorCount instanceof Error) throw locatorCount;
        return locatorCount;
      }),
    })),
    waitForTimeout: vi.fn().mockResolvedValue(undefined),
  } as unknown as Page;
}

describe("snapshot-first readiness", () => {
  it("retries a fieldless snapshot within the bounded attempt count", async () => {
    const page = mockPage([emptySnapshot, fieldSnapshot]);
    const result = await waitForPostNavigationReadiness(page, "ASHBY", true);
    expect(result.surface.kind).toBe("PAGE");
    expect(page.snapshot).toHaveBeenCalledTimes(2);
    expect(page.waitForTimeout).toHaveBeenCalledTimes(1);
  });

  it("ignores an optional locator fallback failure and keeps snapshot retrying", async () => {
    const page = mockPage([emptySnapshot, fieldSnapshot], new Error("Uncaught", {
      cause: { code: -32603, message: "Uncaught", data: { name: "Error" } },
    }));
    await expect(waitForPostNavigationReadiness(page, "ASHBY", true)).resolves.toMatchObject({
      snapshotProbe: { hasApplicationControls: true },
    });
    expect(page.snapshot).toHaveBeenCalledTimes(2);
  });

  it("reports the exact readiness substep that failed", async () => {
    const page = mockPage([fieldSnapshot]);
    vi.mocked(page.url).mockRejectedValueOnce(new Error("Uncaught", {
      cause: { code: -32603, message: "Uncaught", data: { name: "Error" } },
    }));
    await expect(waitForPostNavigationReadiness(page, "ASHBY", true)).rejects.toMatchObject({
      name: "ReadinessSubstepError",
      data: { substep: "PAGE_URL" },
    });
  });

  it("falls back once to a non-iframe snapshot when iframe snapshotting fails", async () => {
    const page = mockPage([new Error("Uncaught"), fieldSnapshot]);
    const result = await waitForPostNavigationReadiness(page, "ASHBY", true);
    expect(result.signal).toBe("SNAPSHOT_WITHOUT_IFRAMES");
    expect(page.snapshot).toHaveBeenNthCalledWith(1, { includeIframes: true });
    expect(page.snapshot).toHaveBeenNthCalledWith(2, { includeIframes: false });
  });
});
