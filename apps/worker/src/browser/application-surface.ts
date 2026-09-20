import type { Page, SnapshotResult } from "@browserbasehq/stagehand";

export type PageApplicationSurface = {
  kind: "PAGE";
  url: string;
};

export type FrameApplicationSurface = {
  kind: "FRAME";
  url: string;
  name: string | null;
  xpathPrefix: string;
  index: number;
};

export type ApplicationSurface = PageApplicationSurface | FrameApplicationSurface;

export type SnapshotControl = {
  id: string;
  role: string;
  label: string;
  xpath: string;
  insideIframe: boolean;
  frameXPathPrefix: string | null;
};

export type SnapshotApplicationProbe = {
  hasApplicationControls: boolean;
  controlCount: number;
  iframeControlCount: number;
  topLevelControlCount: number;
  iframeContentPresent: boolean;
  controls: SnapshotControl[];
  surface: ApplicationSurface | null;
};

function xpathSegments(xpath: string): string[] {
  return xpath.split("/").filter(Boolean);
}

function frameXPathPrefix(xpath: string): string | null {
  const segments = xpathSegments(xpath);
  let lastIframe = -1;
  for (let index = 0; index < segments.length; index += 1) {
    if (/^iframe(?:\[\d+])?$/i.test(segments[index]!)) lastIframe = index;
  }
  return lastIframe >= 0 ? `/${segments.slice(0, lastIframe + 1).join("/")}` : null;
}

function isMeaningfulControl(role: string, label: string, xpath: string): boolean {
  const normalizedRole = role.toLowerCase();
  if (/textbox|textarea|combobox|select|checkbox|radio/.test(normalizedRole)) return true;
  if (/resume|curriculum\s*vitae|cover\s*letter|upload|attach/i.test(label)) return true;
  return /\/input(?:\[|$)/i.test(xpath) && /file/i.test(normalizedRole);
}

function frameIndex(prefix: string): number {
  const match = prefix.match(/\/iframe(?:\[(\d+)])?$/i);
  return Math.max(0, Number(match?.[1] ?? 1) - 1);
}

export function analyzeApplicationSnapshot(snapshot: SnapshotResult, pageUrl: string): SnapshotApplicationProbe {
  const controls: SnapshotControl[] = [];
  for (const line of snapshot.formattedTree.split("\n")) {
    const match = line.match(/^\s*\[([^\]]+)]\s+([^:]+?)(?::\s*(.*?))?(?:\s+\[(?:selected|checked)])?$/);
    if (!match) continue;
    const id = match[1]!;
    const role = match[2]!.trim();
    const label = (match[3] ?? "").trim();
    const xpath = snapshot.xpathMap[id];
    if (!xpath || !isMeaningfulControl(role, label, xpath)) continue;
    const prefix = frameXPathPrefix(xpath);
    controls.push({ id, role, label, xpath, insideIframe: prefix !== null, frameXPathPrefix: prefix });
  }

  const frameGroups = new Map<string, SnapshotControl[]>();
  for (const control of controls) {
    if (!control.frameXPathPrefix) continue;
    frameGroups.set(control.frameXPathPrefix, [...frameGroups.get(control.frameXPathPrefix) ?? [], control]);
  }
  const topLevelControls = controls.filter((control) => !control.insideIframe);
  const largestFrame = [...frameGroups.entries()].sort((left, right) => right[1].length - left[1].length)[0];
  let surface: ApplicationSurface | null = null;
  if (largestFrame && largestFrame[1].length >= topLevelControls.length) {
    const [xpathPrefix] = largestFrame;
    const frameNodeId = Object.entries(snapshot.xpathMap).find(([, xpath]) => xpath === xpathPrefix)?.[0];
    surface = {
      kind: "FRAME",
      url: frameNodeId ? snapshot.urlMap[frameNodeId] ?? pageUrl : pageUrl,
      name: null,
      xpathPrefix,
      index: frameIndex(xpathPrefix),
    };
  } else if (controls.length > 0) {
    surface = { kind: "PAGE", url: pageUrl };
  }
  const iframeControlCount = controls.filter((control) => control.insideIframe).length;
  return {
    hasApplicationControls: controls.length > 0,
    controlCount: controls.length,
    iframeControlCount,
    topLevelControlCount: controls.length - iframeControlCount,
    iframeContentPresent: iframeControlCount > 0,
    controls,
    surface,
  };
}

export function locatorForSurface(page: Page, surface: ApplicationSurface, selector: string) {
  if (selector.startsWith("xpath=") || selector.includes(" >> ")) return page.locator(selector);
  if (surface.kind === "FRAME") {
    throw new Error(`Frame field ${selector} has no snapshot-derived cross-frame locator.`);
  }
  return page.locator(selector);
}
