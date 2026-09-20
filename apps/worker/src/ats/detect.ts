export type AtsKind = "GREENHOUSE" | "ASHBY" | "LEVER" | "GENERIC";

export function detectAts(url: string): AtsKind {
  const hostname = new URL(url).hostname.toLowerCase();
  if (hostname.includes("greenhouse.io") || hostname.includes("greenhouse.com")) return "GREENHOUSE";
  if (hostname.includes("ashbyhq.com")) return "ASHBY";
  if (hostname.includes("lever.co")) return "LEVER";
  return "GENERIC";
}

export function isDirectApplicationPage(url: string, ats: AtsKind): boolean {
  const parsed = new URL(url);
  return ats === "ASHBY" && /\/application\/?$/.test(parsed.pathname);
}
