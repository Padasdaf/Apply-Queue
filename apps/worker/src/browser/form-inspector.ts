import { applicationFieldSchema, type ApplicationField } from "@applyqueue/shared";
import type { Page, SnapshotResult } from "@browserbasehq/stagehand";
import { z } from "zod/v4";
import type { AtsKind } from "../ats/detect.js";
import type { ApplicationSurface } from "./application-surface.js";

const fieldsSchema = z.array(applicationFieldSchema);
const rawOptionSchema = z.object({ label: z.string(), value: z.string() });
const rawControlSchema = z.object({
  index: z.number().int().nonnegative(),
  marker: z.string(),
  tag: z.string(),
  inputType: z.string(),
  id: z.string(),
  name: z.string(),
  autocomplete: z.string(),
  label: z.string(),
  context: z.string(),
  required: z.boolean(),
  options: z.array(rawOptionSchema),
});
const rawControlsSchema = z.array(rawControlSchema);

export type RawInspectedControl = z.infer<typeof rawControlSchema>;

export function hasMeaningfulApplicationFields(fields: ApplicationField[]): boolean {
  const applicationSignals = fields.filter((field) => {
    const text = `${field.label} ${field.identifier}`;
    return /first\s*name|last\s*name|e-?mail|phone|resume|curriculum\s*vitae|cover\s*letter/i.test(text);
  });
  const nonSearchFields = fields.filter((field) => field.inputType !== "search" && !/search/i.test(field.label));
  return applicationSignals.length >= 1 || nonSearchFields.length >= 3;
}

function applicationFieldType(control: RawInspectedControl): ApplicationField["type"] {
  if (control.tag === "textarea") return "textarea";
  if (control.tag === "select") return "select";
  if (["text", "url", "date", "month", "number", "search"].includes(control.inputType)) return "text";
  if (control.inputType === "email") return "email";
  if (control.inputType === "tel") return "phone";
  if (control.inputType === "radio") return "radio";
  if (control.inputType === "checkbox") return "checkbox";
  if (control.inputType === "file") return "file";
  return "unknown";
}

export function normalizeInspectedControls(raw: unknown): ApplicationField[] {
  const controls = rawControlsSchema.parse(raw);
  const handledRadioNames = new Set<string>();
  const fields: ApplicationField[] = [];

  for (const control of controls) {
    if (control.inputType === "radio" && control.name) {
      if (handledRadioNames.has(control.name)) continue;
      handledRadioNames.add(control.name);
      const radios = controls.filter((item) => item.inputType === "radio" && item.name === control.name);
      const optionValues: Record<string, string> = {};
      const optionSelectors: Record<string, string> = {};
      for (const radio of radios) {
        const option = radio.label || radio.options[0]?.label || radio.name;
        optionValues[option] = radio.options[0]?.value ?? "";
        optionSelectors[option] = `[data-applyqueue-id="${radio.marker}"]`;
      }
      const label = control.context.split(" | ")[0] || control.label || control.name;
      fields.push({
        identifier: `${control.name}:${control.index}`,
        label,
        selector: optionSelectors[Object.keys(optionSelectors)[0] ?? ""] ?? `[data-applyqueue-id="${control.marker}"]`,
        type: "radio",
        inputType: "radio",
        name: control.name,
        context: control.context,
        required: radios.some((radio) => radio.required) || /\*|\(\s*required\s*\)|\brequired\s*$/i.test(label),
        options: Object.keys(optionValues),
        optionValues,
        optionSelectors,
      });
      continue;
    }

    const label = control.label || control.name || control.id || control.marker;
    const options = control.options.map((option) => option.label).filter(Boolean);
    const optionValues = Object.fromEntries(control.options.map((option) => [option.label, option.value]));
    fields.push({
      identifier: `${control.name || control.id || control.marker}:${control.index}`,
      label,
      selector: `[data-applyqueue-id="${control.marker}"]`,
      type: applicationFieldType(control),
      inputType: control.inputType,
      ...(control.name ? { name: control.name } : {}),
      ...(control.autocomplete ? { autocomplete: control.autocomplete } : {}),
      ...(control.context ? { context: control.context } : {}),
      required: control.required || /\*|\(\s*required\s*\)|\brequired\s*$/i.test(label),
      ...(options.length > 0 ? { options, optionValues } : {}),
    });
  }
  return fieldsSchema.parse(fields);
}

function xpathSegments(xpath: string): string[] {
  return xpath.split("/").filter(Boolean).map((segment) => segment.replace(/\[1\]$/, ""));
}

function xpathIsWithin(xpath: string, prefix: string): boolean {
  const pathSegments = xpathSegments(xpath);
  const prefixSegments = xpathSegments(prefix);
  return pathSegments.length > prefixSegments.length
    && prefixSegments.every((segment, index) => pathSegments[index] === segment);
}

function snapshotFieldType(role: string, label: string, xpath: string): ApplicationField["type"] | null {
  const normalizedRole = role.toLowerCase();
  const tag = xpath.match(/\/(input|textarea|select)(?:\[|$)/i)?.[1]?.toLowerCase();
  if (tag === "textarea") return "textarea";
  if (tag === "select" || /combobox|select/.test(normalizedRole)) return "select";
  if (/checkbox/.test(normalizedRole)) return "checkbox";
  if (/radio/.test(normalizedRole)) return "radio";
  if (tag === "input" && /resume|curriculum\s*vitae|cover\s*letter|upload.*file|attach.*file/i.test(label)) return "file";
  if (/textbox|searchbox|text field/.test(normalizedRole) || tag === "input") {
    if (/e-?mail/i.test(label)) return "email";
    if (/phone|telephone|mobile/i.test(label)) return "phone";
    return "text";
  }
  return null;
}

function decodeHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function parseSelectOptions(html: string): Array<{ label: string; value: string }> {
  const options: Array<{ label: string; value: string }> = [];
  for (const match of html.matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/gi)) {
    const attributes = match[1] ?? "";
    const label = decodeHtml(match[2] ?? "");
    const valueMatch = attributes.match(/\bvalue\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const value = decodeHtml(valueMatch?.[1] ?? valueMatch?.[2] ?? valueMatch?.[3] ?? label);
    if (label) options.push({ label, value });
  }
  return options;
}

export async function inspectSnapshotFields(
  page: Page,
  snapshot: SnapshotResult,
  surface: ApplicationSurface,
): Promise<ApplicationField[]> {
  const ancestors: Array<{ indent: number; label: string }> = [];
  const fields: ApplicationField[] = [];
  const radios: Array<{ field: ApplicationField; option: string }> = [];

  for (const line of snapshot.formattedTree.split("\n")) {
    const match = line.match(/^(\s*)\[([^\]]+)]\s+([^:]+?)(?::\s*(.*?))?(?:\s+\[(?:selected|checked)])?$/);
    if (!match) continue;
    const indent = match[1]!.length;
    const id = match[2]!;
    const role = match[3]!.trim();
    const label = (match[4] ?? "").trim();
    while (ancestors.length > 0 && ancestors.at(-1)!.indent >= indent) ancestors.pop();
    const context = ancestors.map((ancestor) => ancestor.label).filter(Boolean).slice(-3).join(" | ");
    ancestors.push({ indent, label });

    const xpath = snapshot.xpathMap[id];
    if (!xpath) continue;
    const belongsToSurface = surface.kind === "FRAME"
      ? xpathIsWithin(xpath, surface.xpathPrefix)
      : !xpathSegments(xpath).some((segment) => /^iframe(?:\[\d+])?$/i.test(segment));
    if (!belongsToSurface) continue;
    const type = snapshotFieldType(role, label, xpath);
    if (!type) continue;
    const effectiveLabel = label || context.split(" | ").at(-1) || role;
    const field: ApplicationField = {
      identifier: `snapshot:${id}`,
      label: effectiveLabel,
      selector: `xpath=${xpath}`,
      type,
      inputType: type,
      ...(context ? { context } : {}),
      // Stagehand's cross-frame snapshot does not expose the DOM `required`
      // attribute. Treat fields as required unless the accessible label says
      // optional so unresolved questions cannot be mistaken for review-ready.
      required: !/\boptional\b/i.test(`${effectiveLabel} ${context}`),
    };
    if (type === "radio") radios.push({ field, option: effectiveLabel });
    else fields.push(field);
  }

  const radioGroups = new Map<string, Array<{ field: ApplicationField; option: string }>>();
  for (const radio of radios) {
    const key = radio.field.context || radio.field.identifier;
    radioGroups.set(key, [...radioGroups.get(key) ?? [], radio]);
  }
  for (const [context, group] of radioGroups) {
    const optionSelectors = Object.fromEntries(group.map(({ field, option }) => [option, field.selector]));
    fields.push({
      identifier: `snapshot-radio:${context}`,
      label: context.split(" | ").at(-1) || group[0]!.field.label,
      selector: group[0]!.field.selector,
      type: "radio",
      inputType: "radio",
      context,
      required: group.some(({ field }) => field.required),
      options: group.map(({ option }) => option),
      optionValues: Object.fromEntries(group.map(({ option }) => [option, option])),
      optionSelectors,
    });
  }

  for (const field of fields.filter((candidate) => candidate.type === "select")) {
    const options = parseSelectOptions(await page.locator(field.selector).innerHtml());
    if (options.length > 0) {
      field.options = options.map((option) => option.label);
      field.optionValues = Object.fromEntries(options.map((option) => [option.label, option.value]));
    }
  }
  return fieldsSchema.parse(fields);
}

export async function inspectVisibleFields(
  page: Page,
  _ats: AtsKind,
  surface: ApplicationSurface,
  readinessSnapshot?: SnapshotResult,
): Promise<ApplicationField[]> {
  return inspectSnapshotFields(page, readinessSnapshot ?? await page.snapshot({ includeIframes: true }), surface);
}
