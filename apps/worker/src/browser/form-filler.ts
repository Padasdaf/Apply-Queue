import type { ApplicationField, FieldDecision } from "@applyqueue/shared";
import type { Page } from "@browserbasehq/stagehand";
import { locatorForSurface, type ApplicationSurface } from "./application-surface.js";

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function findMatchingOption(field: ApplicationField, requested: string): string | null {
  const options = field.options ?? [];
  const target = normalize(requested);
  const exact = options.find((option) => normalize(option) === target);
  if (exact) return exact;

  const booleanTarget = /^(yes|true|1)$/.test(target) ? true : /^(no|false|0)$/.test(target) ? false : null;
  if (booleanTarget !== null) {
    const booleanMatch = options.find((option) => {
      const normalized = normalize(option);
      return booleanTarget
        ? /^(yes|true|1|authorized|eligible)$/.test(normalized)
        : /^(no|false|0|not authorized|not eligible)$/.test(normalized);
    });
    if (booleanMatch) return booleanMatch;
  }

  return options.find((option) => {
    const normalized = normalize(option);
    return normalized.length > 2 && (normalized.includes(target) || target.includes(normalized));
  }) ?? null;
}

function requestedBoolean(value: string): boolean | null {
  const normalized = normalize(value);
  if (/^(yes|true|1)$/.test(normalized)) return true;
  if (/^(no|false|0)$/.test(normalized)) return false;
  return null;
}

export async function fillField(
  page: Page,
  field: ApplicationField,
  decision: FieldDecision,
  surface?: ApplicationSurface,
): Promise<void> {
  if (!decision.value) throw new Error(`No value supplied for ${field.identifier}`);
  const locator = surface ? locatorForSurface(page, surface, field.selector) : page.locator(field.selector);

  if (field.type === "select") {
    const option = findMatchingOption(field, decision.value);
    const optionValue = option ? field.optionValues?.[option] ?? option : decision.value;
    await locator.selectOption(optionValue);
    return;
  }
  if (field.type === "radio") {
    const option = findMatchingOption(field, decision.value);
    const selector = option ? field.optionSelectors?.[option] : null;
    if (!selector) throw new Error(`No radio option matched the safe profile answer for ${field.identifier}.`);
    const optionLocator = surface ? locatorForSurface(page, surface, selector) : page.locator(selector);
    if (!(await optionLocator.isChecked())) await optionLocator.click();
    return;
  }
  if (field.type === "checkbox") {
    const desired = requestedBoolean(decision.value);
    if (desired === null) throw new Error(`Checkbox value for ${field.identifier} must be Yes or No.`);
    const checked = await locator.isChecked();
    if (checked !== desired) await locator.click();
    return;
  }
  if (field.type === "file") throw new Error("File fields must use uploadResumeToField().");
  await locator.fill(decision.value);
}
