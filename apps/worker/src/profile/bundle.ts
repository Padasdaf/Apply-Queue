import {
  applicantProfileBundleSchema,
  type ApplicantProfileBundle,
  type ProfileEducation,
  type ProfileEmployment,
} from "@applyqueue/shared";

export type ApplicantProfileBundleRows = {
  profile: unknown;
  educations: unknown;
  employments: unknown;
  links: unknown;
  documents: unknown;
};

export function parseApplicantProfileBundleRows(rows: ApplicantProfileBundleRows): ApplicantProfileBundle {
  return applicantProfileBundleSchema.parse(rows);
}

function descendingEntryDate(entry: {
  is_current: boolean;
  end_year: number | null;
  end_month: number | null;
  start_year: number | null;
  start_month: number | null;
}): number {
  if (entry.is_current) return Number.MAX_SAFE_INTEGER;
  return (entry.end_year ?? entry.start_year ?? 0) * 100 + (entry.end_month ?? entry.start_month ?? 0);
}

/** Selects the current or most recently ended education entry deterministically. */
export function selectPrimaryEducation(entries: ProfileEducation[]): ProfileEducation | null {
  return [...entries].sort((left, right) => {
    const dateDifference = descendingEntryDate(right) - descendingEntryDate(left);
    return dateDifference || left.created_at.localeCompare(right.created_at);
  })[0] ?? null;
}

/** Selects the current or most recently ended employment entry deterministically. */
export function selectPrimaryEmployment(entries: ProfileEmployment[]): ProfileEmployment | null {
  return [...entries].sort((left, right) => {
    const dateDifference = descendingEntryDate(right) - descendingEntryDate(left);
    return dateDifference || left.created_at.localeCompare(right.created_at);
  })[0] ?? null;
}
