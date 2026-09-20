import type { Page, Stagehand } from "@browserbasehq/stagehand";
import type { AtsKind } from "./detect.js";
import { ASHBY_APPLY_SELECTORS } from "./ashby.js";
import { GREENHOUSE_APPLY_SELECTORS } from "./greenhouse.js";

export type OpenApplicationResult = {
  method: "ATS_SELECTOR" | "DOM_TEXT" | "STAGEHAND_OBSERVE";
  ats: AtsKind;
};

const FINAL_SUBMISSION_PATTERN = /\b(?:submit|finish|confirm|complete)(?:\s+(?:the\s+)?application)?\b|\bsend\s+(?:the\s+)?application\b/i;
const APPLICATION_ENTRY_PATTERN = /^(?:apply|apply now|apply for this job|start application)$/i;

export function isFinalSubmissionAction(text: string): boolean {
  return FINAL_SUBMISSION_PATTERN.test(text.replace(/\s+/g, " ").trim());
}

export function isSafeApplicationEntryAction(text: string): boolean {
  const normalized = text.replace(/\s+/g, " ").trim();
  return !isFinalSubmissionAction(normalized) && APPLICATION_ENTRY_PATTERN.test(normalized);
}

export async function openPrimaryApplicationForm(
  page: Page,
  stagehand: Stagehand,
  ats: AtsKind,
): Promise<OpenApplicationResult> {
  const atsSelectors = ats === "GREENHOUSE"
    ? GREENHOUSE_APPLY_SELECTORS
    : ats === "ASHBY" ? ASHBY_APPLY_SELECTORS : [];
  for (const selector of atsSelectors) {
    const locator = page.locator(selector).first();
    if (await locator.count() > 0 && await locator.isVisible()) {
      const text = await locator.textContent();
      if (isFinalSubmissionAction(text)) continue;
      await locator.click();
      return { method: "ATS_SELECTOR", ats };
    }
  }

  const clickedByText = await page.evaluate(() => {
    const candidates = Array.from(document.querySelectorAll("a, button"));
    const candidate = candidates.find((element) => {
      const text = (element.textContent ?? "").replace(/\s+/g, " ").trim();
      const rect = element.getBoundingClientRect();
      const visible = rect.width > 0 && rect.height > 0 && window.getComputedStyle(element).visibility !== "hidden";
      const formSubmit = element instanceof HTMLButtonElement && element.type === "submit";
      const finalSubmit = /\b(?:submit|finish|confirm|complete)(?:\s+(?:the\s+)?application)?\b|\bsend\s+(?:the\s+)?application\b/i.test(text);
      return visible && !formSubmit && !finalSubmit && /^(?:apply|apply now|apply for this job|start application)$/i.test(text);
    }) as HTMLElement | undefined;
    if (!candidate) return false;
    candidate.click();
    return true;
  });
  if (clickedByText) return { method: "DOM_TEXT", ats };

  const observed = await stagehand.observe(
    "Find the primary button or link that opens this job's application form. Exclude any final Submit Application, Finish, or confirmation button.",
  );
  const safeActions = observed.data.filter((item) => !isFinalSubmissionAction(item.description));
  const action = safeActions.find((item) => /apply|start.*application|open.*application/i.test(item.description));
  if (!action) throw new Error("No safe Apply button or link was found.");
  const actionTarget = page.locator(action.selector);
  const targetText = await actionTarget.textContent();
  if (isFinalSubmissionAction(`${action.selector} ${targetText}`)) {
    throw new Error("No safe Apply button or link was found.");
  }
  await actionTarget.click();
  return { method: "STAGEHAND_OBSERVE", ats };
}
