import type { Page, SnapshotResult } from "@browserbasehq/stagehand";
import type { AtsKind } from "../ats/detect.js";
import { PostNavigationStepError, serializeError } from "../errors/serialize-error.js";
import {
  analyzeApplicationSnapshot,
  type ApplicationSurface,
  type SnapshotApplicationProbe,
} from "./application-surface.js";

const SNAPSHOT_ATTEMPTS = 3;
const SNAPSHOT_RETRY_DELAY_MS = 300;
const verboseBrowserDiagnostics = process.env.WORKER_BROWSER_DIAGNOSTICS === "true";

function diagnosticLog(message: string): void {
  if (verboseBrowserDiagnostics) console.log(message);
}

export type PageReadiness = {
  signal: "SNAPSHOT_WITH_IFRAMES" | "SNAPSHOT_WITHOUT_IFRAMES";
  surface: ApplicationSurface;
  snapshot: SnapshotResult;
  snapshotProbe: SnapshotApplicationProbe;
};

export class ReadinessSubstepError extends Error {
  readonly data: { substep: string };

  constructor(substep: string, cause: unknown) {
    const message = cause instanceof Error ? cause.message : String(cause);
    super(`Readiness substep ${substep} failed: ${message}`, { cause });
    this.name = "ReadinessSubstepError";
    this.data = { substep };
  }
}

class ApplicationReadinessError extends Error {
  readonly data: Record<string, unknown>;

  constructor(ats: AtsKind, url: string, title: string, probe: SnapshotApplicationProbe, locatorFallbackCount: number | null) {
    super(`The ${ats} application page loaded, but its iframe-inclusive snapshots contained no meaningful application controls.`);
    this.name = "ApplicationReadinessError";
    this.data = {
      ats,
      url,
      title,
      snapshotAttempts: SNAPSHOT_ATTEMPTS,
      locatorFallbackCount,
      snapshotProbe: {
        hasApplicationControls: probe.hasApplicationControls,
        controlCount: probe.controlCount,
        iframeControlCount: probe.iframeControlCount,
        topLevelControlCount: probe.topLevelControlCount,
        iframeContentPresent: probe.iframeContentPresent,
      },
    };
  }
}

export async function runReadinessSubstep<T>(name: string, operation: () => Promise<T>): Promise<T> {
  diagnosticLog(`READINESS_SUBSTEP: ${name} START`);
  try {
    const result = await operation();
    diagnosticLog(`READINESS_SUBSTEP: ${name} SUCCESS`);
    return result;
  } catch (error) {
    console.error(`READINESS_SUBSTEP: ${name} ERROR`, JSON.stringify(serializeError(error)));
    throw new ReadinessSubstepError(name, error);
  }
}

export async function runPostNavigationStep<T>(name: string, operation: () => Promise<T>): Promise<T> {
  diagnosticLog(`POST_NAV_STEP: ${name} START`);
  try {
    const result = await operation();
    diagnosticLog(`POST_NAV_STEP: ${name} SUCCESS`);
    return result;
  } catch (error) {
    console.error(`POST_NAV_STEP: ${name} ERROR`, JSON.stringify(serializeError(error)));
    throw new PostNavigationStepError(name, error);
  }
}

function logSnapshotProbe(
  url: string,
  attempt: number,
  includeIframes: boolean,
  probe: SnapshotApplicationProbe,
): void {
  diagnosticLog(`SNAPSHOT_PROBE: ${JSON.stringify({
    url,
    attempt,
    includeIframes,
    hasApplicationControls: probe.hasApplicationControls,
    controlCount: probe.controlCount,
    iframeControlCount: probe.iframeControlCount,
    topLevelControlCount: probe.topLevelControlCount,
    iframeContentPresent: probe.iframeContentPresent,
  })}`);
}

async function optionalTopLevelControlCount(page: Page, attempt: number): Promise<number | null> {
  const substep = attempt === 1 ? "OPTIONAL_TOP_LEVEL_CONTROL_COUNT" : `OPTIONAL_TOP_LEVEL_CONTROL_COUNT_RETRY_${attempt - 1}`;
  try {
    return await runReadinessSubstep(substep, () => page.locator("input, select, textarea").count());
  } catch (error) {
    console.warn(`READINESS_OPTIONAL_FALLBACK_IGNORED: ${JSON.stringify(serializeError(error))}`);
    return null;
  }
}

export async function waitForPostNavigationReadiness(
  page: Page,
  ats: AtsKind,
  requireApplicationUi: boolean,
): Promise<PageReadiness> {
  const url = await runReadinessSubstep("PAGE_URL", () => page.url());
  const title = await runReadinessSubstep("PAGE_TITLE", () => page.title());
  let lastProbe: SnapshotApplicationProbe | null = null;
  let lastLocatorFallbackCount: number | null = null;

  for (let attempt = 1; attempt <= SNAPSHOT_ATTEMPTS; attempt += 1) {
    const substep = attempt === 1 ? "SNAPSHOT_WITH_IFRAMES" : `SNAPSHOT_WITH_IFRAMES_RETRY_${attempt - 1}`;
    let snapshot: SnapshotResult;
    try {
      snapshot = await runReadinessSubstep(substep, () => page.snapshot({ includeIframes: true }));
    } catch (includeIframesError) {
      const withoutFrames = await runReadinessSubstep("SNAPSHOT_WITHOUT_IFRAMES", () =>
        page.snapshot({ includeIframes: false }));
      const withoutFramesProbe = analyzeApplicationSnapshot(withoutFrames, url);
      logSnapshotProbe(url, attempt, false, withoutFramesProbe);
      if (withoutFramesProbe.surface) {
        diagnosticLog(`APPLICATION_SURFACE: ${JSON.stringify(withoutFramesProbe.surface)}`);
        return {
          signal: "SNAPSHOT_WITHOUT_IFRAMES",
          surface: withoutFramesProbe.surface,
          snapshot: withoutFrames,
          snapshotProbe: withoutFramesProbe,
        };
      }
      throw includeIframesError;
    }

    const probe = analyzeApplicationSnapshot(snapshot, url);
    lastProbe = probe;
    logSnapshotProbe(url, attempt, true, probe);
    if (probe.surface) {
      diagnosticLog(`APPLICATION_SURFACE: ${JSON.stringify(probe.surface)}`);
      return {
        signal: "SNAPSHOT_WITH_IFRAMES",
        surface: probe.surface,
        snapshot,
        snapshotProbe: probe,
      };
    }
    if (!requireApplicationUi && title.trim()) {
      const surface: ApplicationSurface = { kind: "PAGE", url };
      diagnosticLog(`APPLICATION_SURFACE: ${JSON.stringify(surface)}`);
      return { signal: "SNAPSHOT_WITH_IFRAMES", surface, snapshot, snapshotProbe: probe };
    }

    lastLocatorFallbackCount = await optionalTopLevelControlCount(page, attempt);
    if (attempt < SNAPSHOT_ATTEMPTS) {
      await runReadinessSubstep(`HYDRATION_WAIT_${attempt}`, () => page.waitForTimeout(SNAPSHOT_RETRY_DELAY_MS));
    }
  }

  throw new ApplicationReadinessError(
    ats,
    url,
    title,
    lastProbe ?? analyzeApplicationSnapshot({ formattedTree: "", xpathMap: {}, urlMap: {} }, url),
    lastLocatorFallbackCount,
  );
}
