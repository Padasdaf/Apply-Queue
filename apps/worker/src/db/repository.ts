import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  APPLICATION_DOCUMENTS_BUCKET,
  MAX_RESUME_FILE_SIZE_BYTES,
  applicationSchema,
  getPrimaryResume,
  type ApplicantProfileBundle,
  type Application,
  type ApplicationEventType,
  type ApplicationField,
  type ApplicationStatus,
  type FieldDecision,
  type ProfileDocument,
} from "@applyqueue/shared";
import { env } from "../env.js";
import { parseApplicantProfileBundleRows } from "../profile/bundle.js";

export type DownloadedProfileDocument = {
  document: ProfileDocument;
  bytes: Uint8Array;
};

const STALE_PROCESSING_TIMEOUT_MS = 2 * 60 * 60 * 1000;

export class ApplicationRepository {
  private readonly client: SupabaseClient;

  constructor() {
    this.client = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  async claimNext(): Promise<Application | null> {
    const { data, error } = await this.client.rpc("claim_next_application");
    if (error) throw new Error(`Could not claim an application: ${error.message}`);
    const row = Array.isArray(data) ? data[0] : null;
    return row ? applicationSchema.parse(row) : null;
  }

  async failStaleProcessingApplications(): Promise<number> {
    const cutoff = new Date(Date.now() - STALE_PROCESSING_TIMEOUT_MS).toISOString();
    const completedAt = new Date().toISOString();
    const message = "Worker processing was interrupted. Add the job again to retry safely.";
    const { data, error } = await this.client
      .from("applications")
      .update({ status: "FAILED", completed_at: completedAt, error_message: message })
      .eq("status", "PROCESSING")
      .lt("updated_at", cutoff)
      .select("id");
    if (error) throw new Error(`Could not recover stale processing applications: ${error.message}`);
    if (!data || data.length === 0) return 0;

    const { error: eventError } = await this.client.from("application_events").insert(data.map((row) => ({
      application_id: row.id,
      event_type: "ERROR",
      message,
      metadata: { reason: "STALE_PROCESSING_RECOVERY", cutoff },
    })));
    if (eventError) throw new Error(`Recovered stale applications but could not record their events: ${eventError.message}`);
    return data.length;
  }

  async loadApplicantProfileBundle(profileId: string): Promise<ApplicantProfileBundle> {
    const [profile, educations, employments, links, documents] = await Promise.all([
      this.client.from("profiles").select("*").eq("id", profileId).single(),
      this.client.from("profile_educations").select("*").eq("profile_id", profileId).order("created_at"),
      this.client.from("profile_employments").select("*").eq("profile_id", profileId).order("created_at"),
      this.client.from("profile_links").select("*").eq("profile_id", profileId).order("created_at"),
      this.client.from("documents").select("*").eq("profile_id", profileId).order("created_at", { ascending: false }),
    ]);

    const failure = [profile, educations, employments, links, documents].find((result) => result.error)?.error;
    if (failure) throw new Error(`Could not load applicant profile bundle: ${failure.message}`);
    return parseApplicantProfileBundleRows({
      profile: profile.data,
      educations: educations.data,
      employments: employments.data,
      links: links.data,
      documents: documents.data,
    });
  }

  async downloadPrimaryResume(bundle: ApplicantProfileBundle): Promise<DownloadedProfileDocument | null> {
    const document = getPrimaryResume(bundle.documents);
    if (!document) return null;
    const { data, error } = await this.client.storage
      .from(APPLICATION_DOCUMENTS_BUCKET)
      .download(document.storage_path);
    if (error || !data) throw new Error(`Could not download primary resume: ${error?.message ?? "missing file"}`);

    const bytes = new Uint8Array(await data.arrayBuffer());
    if (bytes.length === 0 || bytes.length > MAX_RESUME_FILE_SIZE_BYTES) {
      throw new Error("Primary resume is empty or exceeds the 10 MB worker limit.");
    }
    if (bytes.length < 5 || String.fromCharCode(...bytes.subarray(0, 5)) !== "%PDF-") {
      throw new Error("Primary resume does not contain a valid PDF signature.");
    }
    return { document, bytes };
  }

  async getApplicationProfileId(applicationId: string): Promise<string> {
    const { data, error } = await this.client.from("applications").select("profile_id").eq("id", applicationId).single();
    if (error || !data) throw new Error(`Could not load application ownership: ${error?.message ?? "missing row"}`);
    return String(data.profile_id);
  }

  async updateApplication(applicationId: string, patch: Record<string, unknown>): Promise<void> {
    const { error } = await this.client.from("applications").update(patch).eq("id", applicationId);
    if (error) throw new Error(`Could not update application: ${error.message}`);
  }

  async setStatus(applicationId: string, status: ApplicationStatus, progress: number, errorMessage?: string): Promise<void> {
    const patch: Record<string, unknown> = { status, progress };
    if (errorMessage !== undefined) patch.error_message = errorMessage;
    if (["READY_FOR_REVIEW", "NEEDS_INPUT", "FAILED", "COMPLETED"].includes(status)) {
      patch.completed_at = new Date().toISOString();
    }
    await this.updateApplication(applicationId, patch);
  }

  async event(
    applicationId: string,
    eventType: ApplicationEventType,
    message: string,
    metadata: Record<string, unknown> = {},
  ): Promise<void> {
    const { error } = await this.client.from("application_events").insert({
      application_id: applicationId,
      event_type: eventType,
      message,
      metadata,
    });
    if (error) throw new Error(`Could not record application event: ${error.message}`);
  }

  async saveQuestion(applicationId: string, field: ApplicationField, decision: FieldDecision): Promise<void> {
    const { error } = await this.client.from("application_questions").upsert(
      {
        application_id: applicationId,
        field_identifier: field.identifier,
        question: field.label,
        answer: null,
        confidence: decision.confidence,
        status: "NEEDS_INPUT",
        metadata: { field, decision },
      },
      { onConflict: "application_id,field_identifier" },
    );
    if (error) throw new Error(`Could not save required question: ${error.message}`);
  }
}
