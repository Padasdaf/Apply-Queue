import { describe, expect, it } from "vitest";
import { DEMO_PROFILE_ID } from "../constants/index.js";
import { applicantProfileBundleSchema, type ApplicantProfileBundle } from "../schemas/profile.js";
import { calculateProfileCompleteness, flattenApplicantProfile, getPrimaryResume } from "./helpers.js";

const timestamp = "2026-09-20T03:22:15.123+00:00";

function makeBundle(): ApplicantProfileBundle {
  return applicantProfileBundleSchema.parse({
    profile: {
      id: DEMO_PROFILE_ID,
      first_name: "Ada",
      last_name: "Lovelace",
      email: "ada@example.com",
      phone: "+1 555 0100",
      city: "Toronto",
      country: "Canada",
      work_authorization: "Authorized to work in Canada",
      requires_sponsorship: false,
      created_at: timestamp,
      updated_at: timestamp,
    },
    educations: [{
      id: "57a58df3-f1be-48ea-9a3c-eb3a00342442",
      profile_id: DEMO_PROFILE_ID,
      school: "University of Waterloo",
      degree: "BMath",
      field_of_study: "Computer Science",
      created_at: timestamp,
      updated_at: timestamp,
    }],
    employments: [{
      id: "d13046fc-2b8d-4c33-9ddb-4491c52aa82f",
      profile_id: DEMO_PROFILE_ID,
      company: "Analytical Engines",
      title: "Engineer",
      created_at: timestamp,
      updated_at: timestamp,
    }],
    links: [{
      id: "5ff9fe71-8341-47c5-a265-9009efeb5370",
      profile_id: DEMO_PROFILE_ID,
      type: "LINKEDIN",
      label: "LinkedIn",
      url: "https://linkedin.com/in/ada",
      created_at: timestamp,
      updated_at: timestamp,
    }],
    documents: [{
      id: "b21ced58-92b1-41ea-814e-a5343b2865f1",
      profile_id: DEMO_PROFILE_ID,
      type: "RESUME",
      storage_path: `profiles/${DEMO_PROFILE_ID}/resume/ada.pdf`,
      filename: "ada.pdf",
      mime_type: "application/pdf",
      file_size_bytes: 4096,
      is_primary: true,
      created_at: timestamp,
      updated_at: timestamp,
    }],
  });
}

describe("applicant profile helpers", () => {
  it("calculates deterministic completeness from ten application essentials", () => {
    const completeness = calculateProfileCompleteness(makeBundle());
    expect(completeness).toMatchObject({ percentage: 100, completed: 10, total: 10 });
  });

  it("accepts explicitly empty employment history as complete", () => {
    const bundle = makeBundle();
    bundle.employments = [];
    bundle.profile.has_no_employment_history = true;
    expect(calculateProfileCompleteness(bundle).items.find((item) => item.key === "employment")?.complete).toBe(true);
  });

  it("finds only the primary resume", () => {
    const bundle = makeBundle();
    bundle.documents.unshift({ ...bundle.documents[0]!, id: "34f8242c-cab6-4eed-aa25-2d43e0c905f4", is_primary: false });
    expect(getPrimaryResume(bundle.documents)?.filename).toBe("ada.pdf");
    expect(getPrimaryResume(bundle.documents)?.is_primary).toBe(true);
  });

  it("flattens normalized education and links for the current worker", () => {
    const flattened = flattenApplicantProfile(makeBundle());
    expect(flattened.location).toBe("Toronto, Canada");
    expect(flattened.school).toBe("University of Waterloo");
    expect(flattened.degree).toBe("BMath");
    expect(flattened.linkedin_url).toBe("https://linkedin.com/in/ada");
  });
});
