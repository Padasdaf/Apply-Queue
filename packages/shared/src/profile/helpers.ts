import type { ApplicantProfile, ApplicantProfileBundle, ProfileDocument } from "../schemas/profile.js";

export type ProfileCompletenessItem = {
  key: string;
  label: string;
  complete: boolean;
};

export type ProfileCompleteness = {
  percentage: number;
  completed: number;
  total: number;
  items: ProfileCompletenessItem[];
};

function present(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

export function getPrimaryResume(documents: ProfileDocument[]): ProfileDocument | null {
  return documents.find((document) => document.type === "RESUME" && document.is_primary) ?? null;
}

export function calculateProfileCompleteness(bundle: ApplicantProfileBundle): ProfileCompleteness {
  const { profile, educations, employments, links, documents } = bundle;
  const items: ProfileCompletenessItem[] = [
    { key: "first_name", label: "First name", complete: present(profile.first_name) },
    { key: "last_name", label: "Last name", complete: present(profile.last_name) },
    { key: "email", label: "Email", complete: present(profile.email) },
    { key: "phone", label: "Phone", complete: present(profile.phone) },
    { key: "location", label: "City and country", complete: present(profile.city) && present(profile.country) },
    { key: "education", label: "Education", complete: educations.length > 0 },
    {
      key: "employment",
      label: "Employment history",
      complete: employments.length > 0 || profile.has_no_employment_history,
    },
    { key: "links", label: "Professional link", complete: links.length > 0 },
    { key: "resume", label: "Primary resume", complete: getPrimaryResume(documents) !== null },
    {
      key: "authorization",
      label: "Work authorization and sponsorship",
      complete: present(profile.work_authorization) && profile.requires_sponsorship !== null,
    },
  ];
  const completed = items.filter((item) => item.complete).length;
  return { percentage: Math.round((completed / items.length) * 100), completed, total: items.length, items };
}

/** Creates the scalar compatibility view used by the current worker. */
export function flattenApplicantProfile(bundle: ApplicantProfileBundle): ApplicantProfile {
  const education = bundle.educations[0];
  const linkByType = (type: "LINKEDIN" | "GITHUB" | "PORTFOLIO") =>
    bundle.links.find((link) => link.type === type)?.url ?? null;
  const composedLocation = [bundle.profile.city, bundle.profile.state_province, bundle.profile.country]
    .filter((value): value is string => present(value))
    .join(", ");

  return {
    ...bundle.profile,
    location: bundle.profile.location ?? (composedLocation || null),
    school: bundle.profile.school ?? education?.school ?? null,
    degree: bundle.profile.degree ?? education?.degree ?? null,
    linkedin_url: bundle.profile.linkedin_url ?? linkByType("LINKEDIN"),
    github_url: bundle.profile.github_url ?? linkByType("GITHUB"),
    portfolio_url: bundle.profile.portfolio_url ?? linkByType("PORTFOLIO"),
  };
}
