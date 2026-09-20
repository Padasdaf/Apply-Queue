import { describe, expect, it } from "vitest";
import { makeProfileBundle } from "../test/profile-fixture.js";
import {
  parseApplicantProfileBundleRows,
  selectPrimaryEducation,
  selectPrimaryEmployment,
} from "./bundle.js";

describe("worker profile bundle helpers", () => {
  it("validates a complete normalized profile bundle from database rows", () => {
    const bundle = makeProfileBundle();
    const parsed = parseApplicantProfileBundleRows(bundle);
    expect(parsed.profile.email).toBe("ada@example.com");
    expect(parsed.educations).toHaveLength(2);
    expect(parsed.documents[0]?.is_primary).toBe(true);
  });

  it("rejects malformed database rows", () => {
    const bundle = makeProfileBundle();
    expect(() => parseApplicantProfileBundleRows({ ...bundle, profile: { ...bundle.profile, id: "not-a-uuid" } }))
      .toThrow();
  });

  it("selects current entries before older entries instead of relying on row order", () => {
    const bundle = makeProfileBundle();
    expect(selectPrimaryEducation([...bundle.educations].reverse())?.school).toBe("University of Waterloo");
    expect(selectPrimaryEmployment([...bundle.employments].reverse())?.company).toBe("Analytical Engines");
  });
});
