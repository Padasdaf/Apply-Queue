import {
  getPrimaryResume,
  type ApplicantProfileBundle,
  type ApplicationField,
  type SemanticFieldType,
} from "@applyqueue/shared";
import { selectPrimaryEducation, selectPrimaryEmployment } from "./bundle.js";

export type ResolvedProfileValue = {
  semanticType: SemanticFieldType;
  profileField: string;
  value: string | null;
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function fieldSearchText(field: ApplicationField): string {
  return [field.label, field.identifier, field.name, field.autocomplete, field.context]
    .filter(Boolean)
    .join(" ")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function has(pattern: RegExp, value: string): boolean {
  return pattern.test(value);
}

export function classifySemanticField(field: ApplicationField): SemanticFieldType | null {
  const text = fieldSearchText(field);
  const direct = [field.label, field.identifier, field.name, field.autocomplete]
    .filter(Boolean)
    .join(" ")
    .replace(/[_-]+/g, " ");
  const label = field.label.trim();
  const educationContext = has(/educat|academic|school|university|college|degree|discipline|major/i, text);
  const employmentContext = has(/employ|work\s*(history|experience)|company|employer|job\s*title|position\s*title/i, text);
  const start = has(/start|from/i, label);
  const end = has(/end|to|graduat/i, label);
  const month = has(/month/i, label);
  const year = has(/year/i, label);

  if (field.type === "file") return has(/resume|curriculum\s*vitae|\bcv\b/i, direct) ? "RESUME" : null;
  if (has(/preferred\s*(first\s*)?name|chosen\s*name/i, direct)) return "PREFERRED_NAME";
  if (has(/first\s*name|given\s*name/i, direct)) return "FIRST_NAME";
  if (has(/last\s*name|family\s*name|surname/i, direct)) return "LAST_NAME";
  if (has(/full\s*name|legal\s*name/i, direct) || /^name\s*\*?$/i.test(label)) return "FULL_NAME";
  if (has(/e-?mail/i, direct)) return "EMAIL";
  if (has(/phone|mobile|telephone/i, direct)) return "PHONE";
  if (has(/address\s*(line\s*)?2|address2|apt\.?|apartment|suite/i, direct)) return "ADDRESS_LINE_2";
  if (has(/street\s*address|address\s*(line\s*)?1|address1/i, direct) || /^address\s*\*?$/i.test(label)) return "ADDRESS_LINE_1";
  if (has(/postal|zip\s*code|zipcode/i, direct)) return "POSTAL_CODE";
  if (has(/state|province|region/i, direct)) return "STATE_PROVINCE";
  if (has(/country/i, direct)) return "COUNTRY";
  if (has(/linkedin/i, direct)) return "LINKEDIN";
  if (has(/github/i, direct)) return "GITHUB";
  if (has(/portfolio|personal\s*(site|website)/i, direct)) return "PORTFOLIO";
  if (has(/sponsor|sponsorship/i, direct)) return "SPONSORSHIP";
  if (has(/authorized.*work|work.*authoriz|legally.*work/i, direct)) return "WORK_AUTHORIZATION";
  if (has(/relocat/i, direct)) return "RELOCATION";
  if (has(/preferred\s*locations?|location\s*preferences?/i, direct)) return "PREFERRED_LOCATIONS";
  if (has(/availability|available.*start|start.*available/i, direct)) return "AVAILABILITY_DATE";
  if (has(/graduat|expected.*completion/i, direct)) return "GRADUATION_DATE";

  if (educationContext && start) return month ? "EDUCATION_START_MONTH" : year ? "EDUCATION_START_YEAR" : "EDUCATION_START_DATE";
  if (educationContext && end) return month ? "EDUCATION_END_MONTH" : year ? "EDUCATION_END_YEAR" : "EDUCATION_END_DATE";
  if (has(/field\s*of\s*study|discipline|major|concentration/i, direct)) return "FIELD_OF_STUDY";
  if (has(/school|university|college|institution/i, direct)) return "SCHOOL";
  if (has(/degree|qualification/i, direct)) return "DEGREE";

  if (employmentContext && start) return month ? "EMPLOYMENT_START_MONTH" : year ? "EMPLOYMENT_START_YEAR" : "EMPLOYMENT_START_DATE";
  if (employmentContext && end) return month ? "EMPLOYMENT_END_MONTH" : year ? "EMPLOYMENT_END_YEAR" : "EMPLOYMENT_END_DATE";
  if (has(/currently.*(work|employ)|current\s*(job|employment|position)/i, direct)) return "CURRENT_EMPLOYMENT";
  if (has(/company|employer|organization/i, direct)) return "EMPLOYER";
  if (has(/job\s*title|position\s*title|role\s*title/i, direct)) return "JOB_TITLE";
  if (employmentContext && has(/location|city/i, label)) return "EMPLOYMENT_LOCATION";
  if (has(/city/i, direct)) return "CITY";
  if (has(/location|where.*located/i, direct)) return "LOCATION";
  return null;
}

function findLink(bundle: ApplicantProfileBundle, type: "LINKEDIN" | "GITHUB" | "PORTFOLIO"): string | null {
  return bundle.links.find((link) => link.type === type)?.url ?? null;
}

function formatMonth(month: number | null): string | null {
  return month ? MONTHS[month - 1] ?? null : null;
}

function formatMonthYear(month: number | null, year: number | null, field: ApplicationField): string | null {
  if (!month && !year) return null;
  if (field.inputType === "date" && year && month) return `${year}-${String(month).padStart(2, "0")}-01`;
  if (month && year) return `${String(month).padStart(2, "0")}/${year}`;
  return year ? String(year) : formatMonth(month);
}

function explicitAuthorizationAnswer(value: string, field: ApplicationField): string {
  if (!["radio", "checkbox", "select"].includes(field.type)) return value;
  if (/\b(not authorized|not eligible|no)\b/i.test(value)) return "No";
  if (/\b(authorized|eligible|yes)\b/i.test(value)) return "Yes";
  return value;
}

function graduationValue(
  field: ApplicationField,
  savedValue: string | null,
  month: number | null,
  year: number | null,
): string | null {
  if (/month/i.test(field.label)) return formatMonth(month);
  if (/year/i.test(field.label)) return year ? String(year) : null;
  if (field.inputType === "date") return formatMonthYear(month, year, field);
  return savedValue ?? formatMonthYear(month, year, field);
}

export function resolveProfileValue(
  semanticType: SemanticFieldType,
  field: ApplicationField,
  bundle: ApplicantProfileBundle,
): ResolvedProfileValue {
  const { profile } = bundle;
  const education = selectPrimaryEducation(bundle.educations);
  const employment = selectPrimaryEmployment(bundle.employments);
  const location = [profile.city, profile.state_province, profile.country].filter(Boolean).join(", ") || profile.location;
  const values: Partial<Record<SemanticFieldType, { profileField: string; value: string | null }>> = {
    FIRST_NAME: { profileField: "profile.first_name", value: profile.first_name },
    LAST_NAME: { profileField: "profile.last_name", value: profile.last_name },
    FULL_NAME: { profileField: "profile.first_name+last_name", value: `${profile.first_name} ${profile.last_name}`.trim() },
    PREFERRED_NAME: { profileField: "profile.preferred_name", value: profile.preferred_name },
    EMAIL: { profileField: "profile.email", value: profile.email },
    PHONE: { profileField: "profile.phone", value: profile.phone },
    ADDRESS_LINE_1: { profileField: "profile.address_line_1", value: profile.address_line_1 },
    ADDRESS_LINE_2: { profileField: "profile.address_line_2", value: profile.address_line_2 },
    CITY: { profileField: "profile.city", value: profile.city },
    STATE_PROVINCE: { profileField: "profile.state_province", value: profile.state_province },
    POSTAL_CODE: { profileField: "profile.postal_code", value: profile.postal_code },
    COUNTRY: { profileField: "profile.country", value: profile.country },
    LOCATION: { profileField: "profile.location", value: location || null },
    SCHOOL: { profileField: "educations[primary].school", value: education?.school ?? profile.school },
    DEGREE: { profileField: "educations[primary].degree", value: education?.degree ?? profile.degree },
    FIELD_OF_STUDY: { profileField: "educations[primary].field_of_study", value: education?.field_of_study ?? null },
    EDUCATION_START_DATE: { profileField: "educations[primary].start", value: formatMonthYear(education?.start_month ?? null, education?.start_year ?? null, field) },
    EDUCATION_START_MONTH: { profileField: "educations[primary].start_month", value: formatMonth(education?.start_month ?? null) },
    EDUCATION_START_YEAR: { profileField: "educations[primary].start_year", value: education?.start_year ? String(education.start_year) : null },
    EDUCATION_END_DATE: { profileField: "educations[primary].end", value: formatMonthYear(education?.end_month ?? null, education?.end_year ?? null, field) },
    EDUCATION_END_MONTH: { profileField: "educations[primary].end_month", value: formatMonth(education?.end_month ?? null) },
    EDUCATION_END_YEAR: { profileField: "educations[primary].end_year", value: education?.end_year ? String(education.end_year) : null },
    GRADUATION_DATE: {
      profileField: "profile.graduation_date",
      value: graduationValue(
        field,
        profile.graduation_date,
        education?.end_month ?? null,
        education?.end_year ?? null,
      ),
    },
    EMPLOYER: { profileField: "employments[primary].company", value: employment?.company ?? null },
    JOB_TITLE: { profileField: "employments[primary].title", value: employment?.title ?? null },
    EMPLOYMENT_LOCATION: { profileField: "employments[primary].location", value: employment?.location ?? null },
    EMPLOYMENT_START_DATE: { profileField: "employments[primary].start", value: formatMonthYear(employment?.start_month ?? null, employment?.start_year ?? null, field) },
    EMPLOYMENT_START_MONTH: { profileField: "employments[primary].start_month", value: formatMonth(employment?.start_month ?? null) },
    EMPLOYMENT_START_YEAR: { profileField: "employments[primary].start_year", value: employment?.start_year ? String(employment.start_year) : null },
    EMPLOYMENT_END_DATE: { profileField: "employments[primary].end", value: formatMonthYear(employment?.end_month ?? null, employment?.end_year ?? null, field) },
    EMPLOYMENT_END_MONTH: { profileField: "employments[primary].end_month", value: formatMonth(employment?.end_month ?? null) },
    EMPLOYMENT_END_YEAR: { profileField: "employments[primary].end_year", value: employment?.end_year ? String(employment.end_year) : null },
    CURRENT_EMPLOYMENT: { profileField: "employments[primary].is_current", value: employment ? (employment.is_current ? "Yes" : "No") : null },
    LINKEDIN: { profileField: "links.LINKEDIN", value: findLink(bundle, "LINKEDIN") ?? profile.linkedin_url },
    GITHUB: { profileField: "links.GITHUB", value: findLink(bundle, "GITHUB") ?? profile.github_url },
    PORTFOLIO: { profileField: "links.PORTFOLIO", value: findLink(bundle, "PORTFOLIO") ?? profile.portfolio_url },
    WORK_AUTHORIZATION: { profileField: "profile.work_authorization", value: profile.work_authorization ? explicitAuthorizationAnswer(profile.work_authorization, field) : null },
    SPONSORSHIP: { profileField: "profile.requires_sponsorship", value: profile.requires_sponsorship === null ? null : profile.requires_sponsorship ? "Yes" : "No" },
    RELOCATION: { profileField: "profile.willing_to_relocate", value: profile.willing_to_relocate === null ? null : profile.willing_to_relocate ? "Yes" : "No" },
    PREFERRED_LOCATIONS: { profileField: "profile.preferred_locations", value: profile.preferred_locations.length > 0 ? profile.preferred_locations.join(", ") : null },
    AVAILABILITY_DATE: { profileField: "profile.availability_start_date", value: profile.availability_start_date },
    RESUME: { profileField: "documents.primaryResume", value: getPrimaryResume(bundle.documents)?.filename ?? null },
  };
  const resolved = values[semanticType] ?? { profileField: "", value: null };
  return { semanticType, ...resolved };
}

export function safeApplicantContext(bundle: ApplicantProfileBundle) {
  const education = selectPrimaryEducation(bundle.educations);
  const employment = selectPrimaryEmployment(bundle.employments);
  const educationFacts = bundle.educations.map((entry) => ({
    school: entry.school,
    degree: entry.degree,
    fieldOfStudy: entry.field_of_study,
    startMonth: entry.start_month,
    startYear: entry.start_year,
    endMonth: entry.end_month,
    endYear: entry.end_year,
    isCurrent: entry.is_current,
    gpa: entry.gpa,
    location: entry.location,
  }));
  const employmentFacts = bundle.employments.map((entry) => ({
    company: entry.company,
    title: entry.title,
    location: entry.location,
    startMonth: entry.start_month,
    startYear: entry.start_year,
    endMonth: entry.end_month,
    endYear: entry.end_year,
    isCurrent: entry.is_current,
    description: entry.description,
  }));
  return {
    profile: {
      firstName: bundle.profile.first_name,
      lastName: bundle.profile.last_name,
      preferredName: bundle.profile.preferred_name,
      email: bundle.profile.email,
      phone: bundle.profile.phone,
      addressLine1: bundle.profile.address_line_1,
      addressLine2: bundle.profile.address_line_2,
      city: bundle.profile.city,
      stateProvince: bundle.profile.state_province,
      postalCode: bundle.profile.postal_code,
      country: bundle.profile.country,
      graduationDate: bundle.profile.graduation_date,
      shortBio: bundle.profile.short_bio,
      workAuthorization: bundle.profile.work_authorization,
      requiresSponsorship: bundle.profile.requires_sponsorship,
      willingToRelocate: bundle.profile.willing_to_relocate,
      preferredLocations: bundle.profile.preferred_locations,
      availabilityStartDate: bundle.profile.availability_start_date,
    },
    primaryEducation: education ? educationFacts[bundle.educations.indexOf(education)] ?? null : null,
    primaryEmployment: employment ? employmentFacts[bundle.employments.indexOf(employment)] ?? null : null,
    educations: educationFacts,
    employments: employmentFacts,
    links: bundle.links.map(({ type, label, url }) => ({ type, label, url })),
    primaryResumeAvailable: getPrimaryResume(bundle.documents) !== null,
  };
}
