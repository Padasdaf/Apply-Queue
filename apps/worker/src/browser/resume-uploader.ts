import type { ApplicationField } from "@applyqueue/shared";
import type { Page } from "@browserbasehq/stagehand";
import type { DownloadedProfileDocument } from "../db/repository.js";
import { locatorForSurface, type ApplicationSurface } from "./application-surface.js";

export async function uploadResumeToField(
  page: Page,
  field: ApplicationField,
  resume: DownloadedProfileDocument,
  surface?: ApplicationSurface,
): Promise<void> {
  if (field.type !== "file") throw new Error(`${field.identifier} is not a file input.`);
  const locator = surface ? locatorForSurface(page, surface, field.selector) : page.locator(field.selector);
  await locator.setInputFiles({
    name: resume.document.filename,
    mimeType: "application/pdf",
    buffer: resume.bytes,
    lastModified: Date.now(),
  });
  const value = await locator.inputValue();
  if (!value) throw new Error(`Resume input ${field.identifier} remained empty after upload.`);
}
