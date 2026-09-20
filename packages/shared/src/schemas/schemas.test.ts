import { describe, expect, it } from "vitest";
import { DEMO_PROFILE_ID } from "../constants/index.js";
import { applicationEventSchema, applicationSchema, createApplicationSchema } from "./application.js";
import { postgresTimestampSchema } from "./common.js";
import { fieldDecisionSchema } from "./field.js";
import { applicantProfileInputSchema, applicantProfileSchema, profileDocumentSchema } from "./profile.js";

describe("shared boundary schemas", () => {
  it("rejects non-web application URLs", () => {
    expect(() => createApplicationSchema.parse({ url: "ftp://example.com/job" })).toThrow();
  });

  it("preserves nullable work authorization and sponsorship semantics", () => {
    const profile = applicantProfileInputSchema.parse({
      first_name: "Ada",
      last_name: "Lovelace",
      email: "ada@example.com",
      work_authorization: null,
      requires_sponsorship: null,
    });
    expect(profile.work_authorization).toBeNull();
    expect(profile.requires_sponsorship).toBeNull();
  });

  it("accepts the RFC-versioned demo profile UUID", () => {
    const profile = applicantProfileSchema.parse({
      id: DEMO_PROFILE_ID,
      first_name: "Ada",
      last_name: "Lovelace",
      email: "ada@example.com",
      created_at: "2026-09-20T03:22:15.123+00:00",
      updated_at: "2026-09-20T03:22:15.123+00:00",
    });
    expect(profile.id).toBe("00000000-0000-4000-8000-000000000001");
  });

  it("accepts a Postgres timestamptz value with an explicit UTC offset", () => {
    expect(postgresTimestampSchema.parse("2026-09-20T03:22:15.123+00:00"))
      .toBe("2026-09-20T03:22:15.123+00:00");
  });

  it("accepts resume metadata returned by Postgres", () => {
    const document = profileDocumentSchema.parse({
      id: "af4398d8-35a5-454c-a433-6224fb621e73",
      profile_id: DEMO_PROFILE_ID,
      type: "RESUME",
      storage_path: `${DEMO_PROFILE_ID}/resume/ada.pdf`,
      filename: "ada.pdf",
      mime_type: "application/pdf",
      file_size_bytes: 2048,
      is_primary: true,
      created_at: "2026-09-20T03:22:15.123+00:00",
      updated_at: "2026-09-20T04:22:15.123+00:00",
    });
    expect(document.type).toBe("RESUME");
    expect(document.is_primary).toBe(true);
  });

  it("preserves nullable application timestamps", () => {
    const timestamp = "2026-09-20T03:22:15.123+00:00";
    const application = applicationSchema.parse({
      id: "4f4eaad4-5db6-4f30-9bfd-5fa42fae8f22",
      url: "https://example.com/jobs/software-engineer",
      company: "Example",
      role: "Software Engineer",
      status: "QUEUED",
      progress: 0,
      browserbase_session_id: null,
      browserbase_session_url: null,
      error_message: null,
      processing_requested_at: null,
      created_at: timestamp,
      started_at: null,
      completed_at: null,
      updated_at: timestamp,
    });
    expect(application.processing_requested_at).toBeNull();
    expect(application.started_at).toBeNull();
    expect(application.completed_at).toBeNull();
  });

  it("accepts the resume uploaded timeline event", () => {
    const event = applicationEventSchema.parse({
      id: "648e372c-c0fb-4f8b-a408-ac5e1077eaa7",
      application_id: "4f4eaad4-5db6-4f30-9bfd-5fa42fae8f22",
      event_type: "RESUME_UPLOADED",
      message: "Attached the primary resume.",
      metadata: { field: "Resume / CV" },
      created_at: "2026-09-20T03:22:15.123+00:00",
    });
    expect(event.event_type).toBe("RESUME_UPLOADED");
  });

  it("requires confidence to stay within a safe range", () => {
    expect(() => fieldDecisionSchema.parse({
      fieldIdentifier: "email",
      semanticType: "EMAIL",
      action: "PROFILE_LOOKUP",
      profileField: "email",
      value: "ada@example.com",
      confidence: 1.2,
      reason: "match",
    })).toThrow();
  });
});
