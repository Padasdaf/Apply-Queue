import type { Application, ApplicationField, FieldDecision } from "@applyqueue/shared";
import type { Page } from "@browserbasehq/stagehand";
import { resolveFields } from "../ai/field-reasoner.js";
import { fillField } from "../browser/form-filler.js";
import { hasMeaningfulApplicationFields, inspectVisibleFields } from "../browser/form-inspector.js";
import {
  runPostNavigationStep,
  waitForPostNavigationReadiness,
} from "../browser/post-navigation.js";
import { uploadResumeToField } from "../browser/resume-uploader.js";
import { createBrowserSession, type BrowserSession } from "../browser/session.js";
import { ApplicationRepository } from "../db/repository.js";
import { detectAts, isDirectApplicationPage, type AtsKind } from "../ats/detect.js";
import { openPrimaryApplicationForm } from "../ats/open-application.js";
import type { ApplicationSurface } from "../browser/application-surface.js";
import {
  formatErrorMessage,
  isTransientBrowserReadError,
  serializeError,
} from "../errors/serialize-error.js";

async function inspectPostNavigationFields(
  session: BrowserSession,
  initialPage: Page,
  ats: AtsKind,
  requireApplicationUi: boolean,
  stepPrefix = "",
): Promise<{ page: Page; fields: ApplicationField[]; surface: ApplicationSurface }> {
  const readOnce = async (page: Page, retry: boolean) => {
    const suffix = retry ? "_RETRY" : "";
    const readiness = await runPostNavigationStep(`${stepPrefix}WAIT_FOR_READINESS${suffix}`, () =>
      waitForPostNavigationReadiness(page, ats, requireApplicationUi));
    const fields = await runPostNavigationStep(`${stepPrefix}FORM_INSPECTION${suffix}`, () =>
      inspectVisibleFields(page, ats, readiness.surface, readiness.snapshot));
    return { page, fields, surface: readiness.surface };
  };

  try {
    return await readOnce(initialPage, false);
  } catch (error) {
    if (!isTransientBrowserReadError(error)) throw error;
    console.warn("POST_NAV_READ_RETRY: transient browser RPC/read failure; retrying once.", JSON.stringify(serializeError(error)));
    const page = await runPostNavigationStep(`${stepPrefix}REACQUIRE_ACTIVE_PAGE_RETRY`, async () => {
      const activePage = await session.browser.context.activePage();
      if (!activePage) throw new Error("Browserbase session has no active page after the transient read failure.");
      return activePage;
    });
    return readOnce(page, true);
  }
}

export class ApplicationRunner {
  constructor(private readonly repository: ApplicationRepository) {}

  async run(application: Application): Promise<void> {
    let session: BrowserSession | null = null;
    let currentProgress = application.progress;
    const updateProgress = async (progress: number, patch: Record<string, unknown> = {}) => {
      await this.repository.updateApplication(application.id, { ...patch, progress });
      currentProgress = progress;
    };
    try {
      await this.repository.event(application.id, "PROCESSING_STARTED", "Worker started processing this application.");
      session = await createBrowserSession();
      await updateProgress(15, {
        browserbase_session_id: session.sessionId,
        browserbase_session_url: session.liveViewUrl,
      });
      await this.repository.event(application.id, "SESSION_CREATED", "Browserbase cloud browser is ready.", {
        sessionId: session.sessionId,
        liveViewUrl: session.liveViewUrl,
      });

      let page = await session.browser.context.activePage();
      if (!page) throw new Error("Browserbase session has no active page.");
      await page.goto(application.url, { waitUntil: "domcontentloaded", timeout: 30_000 });
      const currentUrl = await page.url();
      const ats = detectAts(currentUrl);
      const directApplicationPage = isDirectApplicationPage(currentUrl, ats);
      await updateProgress(30);
      await this.repository.event(application.id, "NAVIGATED_TO_JOB", "Opened the job URL in Browserbase.", {
        url: currentUrl,
        title: await page.title(),
        ats,
        directApplicationPage,
      });
      console.log(`[${application.id}] Navigated to ${ats} job page: ${currentUrl}`);

      let inspection = await inspectPostNavigationFields(session, page, ats, directApplicationPage);
      page = inspection.page;
      let fields = inspection.fields;
      let surface = inspection.surface;
      if (!hasMeaningfulApplicationFields(fields)) {
        if (directApplicationPage) {
          throw new Error("The direct Ashby application page became ready, but no meaningful application fields were found.");
        }
        const opened = await openPrimaryApplicationForm(page, session.stagehand, ats);
        await this.repository.event(application.id, "FOUND_APPLY_BUTTON", "Found and activated the application entry point.", opened);
        inspection = await inspectPostNavigationFields(session, page, ats, true, "POST_APPLY_");
        page = inspection.page;
        surface = inspection.surface;
        await this.repository.event(application.id, "OPENED_APPLICATION", "Opened the application form.", {
          url: await page.url(),
          ats,
          method: opened.method,
        });
        fields = inspection.fields;
      } else {
        await this.repository.event(application.id, "OPENED_APPLICATION", "Application form is visible on the job page.", {
          url: currentUrl,
          ats,
          method: "IN_PAGE",
        });
      }

      if (!hasMeaningfulApplicationFields(fields)) {
        throw new Error("No visible application form fields were found after opening the application flow.");
      }

      await updateProgress(50);
      await this.repository.event(application.id, "FIELDS_DISCOVERED", `Found ${fields.length} visible form fields.`, {
        ats,
        applicationSurface: surface.kind === "FRAME"
          ? { kind: surface.kind, url: surface.url, name: surface.name, index: surface.index }
          : { kind: surface.kind, url: surface.url },
        fields: fields.map(({ identifier, label, type, required, context }) => ({
          identifier,
          label,
          type,
          required,
          context,
        })),
      });
      const profileId = await this.repository.getApplicationProfileId(application.id);
      const bundle = await this.repository.loadApplicantProfileBundle(profileId);
      console.log(`[${application.id}] Loaded profile bundle: ${bundle.educations.length} education, ${bundle.employments.length} employment, ${bundle.links.length} link, ${bundle.documents.length} document record(s).`);
      const decisions = await resolveFields(fields, bundle);
      const fieldMap = new Map(fields.map((field) => [field.identifier, field]));
      const needsInput: Array<{ field: ApplicationField; decision: FieldDecision }> = [];
      let downloadedResume: Awaited<ReturnType<ApplicationRepository["downloadPrimaryResume"]>> | undefined;

      for (const decision of decisions) {
        const field = fieldMap.get(decision.fieldIdentifier);
        if (!field) continue;
        if (decision.action === "ASK_USER" || (decision.action === "SKIP" && field.required)) {
          if (field.required) {
            const askDecision: FieldDecision = decision.action === "ASK_USER"
              ? decision
              : { ...decision, action: "ASK_USER", reason: "A required field cannot be skipped safely." };
            needsInput.push({ field, decision: askDecision });
            await this.repository.saveQuestion(application.id, field, askDecision);
          }
          continue;
        }
        if ((decision.action === "PROFILE_LOOKUP" || decision.action === "GENERATE") && decision.value && decision.confidence >= 0.8) {
          try {
            if (decision.semanticType === "RESUME" && field.type === "file") {
              downloadedResume ??= await this.repository.downloadPrimaryResume(bundle);
              if (!downloadedResume) throw new Error("No primary resume is available.");
              await uploadResumeToField(page, field, downloadedResume, surface);
              await this.repository.event(application.id, "RESUME_UPLOADED", "Attached the primary resume.", {
                field: field.label,
                fieldIdentifier: field.identifier,
                documentId: downloadedResume.document.id,
              });
              console.log(`[${application.id}] Uploaded primary resume to ${field.label}.`);
            } else {
              await fillField(page, field, decision, surface);
              await this.repository.event(application.id, "FIELD_FILLED", `Filled ${field.label}.`, {
                field: field.label,
                fieldIdentifier: field.identifier,
                semanticType: decision.semanticType,
                source: decision.action,
              });
            }
          } catch (error) {
            const rawMessage = error instanceof Error ? error.message : "Field fill failed";
            const message = decision.value ? rawMessage.replaceAll(decision.value, "[redacted]") : rawMessage;
            console.warn(`[${application.id}] Could not fill ${field.label}: ${message}`);
            await this.repository.event(application.id, "ERROR", `Could not safely fill ${field.label}.`, {
              field: field.label,
              fieldIdentifier: field.identifier,
              semanticType: decision.semanticType,
              recoverable: true,
              reason: message,
            });
            if (field.required) {
              const askDecision: FieldDecision = { ...decision, action: "ASK_USER", value: null, reason: message };
              needsInput.push({ field, decision: askDecision });
              await this.repository.saveQuestion(application.id, field, askDecision);
            }
          }
        } else if (field.required && decision.action !== "SKIP") {
          const askDecision: FieldDecision = {
            ...decision,
            action: "ASK_USER",
            value: null,
            reason: "No sufficiently confident safe value was available.",
          };
          needsInput.push({ field, decision: askDecision });
          await this.repository.saveQuestion(application.id, field, askDecision);
        }
      }

      if (needsInput.length > 0) {
        await this.repository.setStatus(application.id, "NEEDS_INPUT", 80);
        await this.repository.event(application.id, "NEEDS_INPUT", `Waiting for ${needsInput.length} answer(s).`, {
          fields: needsInput.map(({ field, decision }) => ({
            identifier: field.identifier,
            label: field.label,
            semanticType: decision.semanticType,
          })),
        });
        console.log(`[${application.id}] NEEDS_INPUT: ${needsInput.length} required field(s) remain.`);
      } else {
        await this.repository.setStatus(application.id, "READY_FOR_REVIEW", 100);
        await this.repository.event(application.id, "READY_FOR_REVIEW", "Safe fields are filled. Final submission is disabled.");
        console.log(`[${application.id}] READY_FOR_REVIEW. No submit action was attempted.`);
      }
    } catch (error) {
      const message = formatErrorMessage(error);
      const diagnostic = serializeError(error);
      await this.repository.setStatus(application.id, "FAILED", currentProgress, message).catch(console.error);
      await this.repository.event(application.id, "ERROR", message, {
        error: diagnostic,
      }).catch(console.error);
      console.error(`Application ${application.id} failed`, JSON.stringify(diagnostic));
    } finally {
      if (session) {
        await session.stagehand.close().catch(console.error);
        await session.browser.close().catch(console.error);
      }
    }
  }
}
