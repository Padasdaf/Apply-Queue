import { z } from "zod/v4";
import { postgresTimestampSchema } from "./common.js";

const nullableText = (max = 500) => z.string().trim().max(max).nullable().default(null);
const nullableUrl = z.union([z.url(), z.literal(""), z.null()]).default(null).transform((value) => value || null);
const nullableMonth = z.number().int().min(1).max(12).nullable().default(null);
const nullableYear = z.number().int().min(1900).max(2200).nullable().default(null);

export const profileLinkTypeSchema = z.enum([
  "LINKEDIN",
  "GITHUB",
  "PORTFOLIO",
  "PERSONAL_WEBSITE",
  "OTHER",
]);

export const profileDocumentTypeSchema = z.enum(["RESUME", "COVER_LETTER", "TRANSCRIPT", "OTHER"]);

export const applicantProfileSchema = z.object({
  id: z.uuid(),
  first_name: z.string().trim().min(1).max(100),
  last_name: z.string().trim().min(1).max(100),
  preferred_name: nullableText(100),
  email: z.email(),
  phone: nullableText(100),
  address_line_1: nullableText(250),
  address_line_2: nullableText(250),
  city: nullableText(150),
  state_province: nullableText(150),
  postal_code: nullableText(30),
  country: nullableText(100),
  timezone: nullableText(100),
  graduation_date: nullableText(100),
  work_authorization: nullableText(500),
  requires_sponsorship: z.boolean().nullable().default(null),
  willing_to_relocate: z.boolean().nullable().default(null),
  preferred_locations: z.array(z.string().trim().min(1).max(150)).default([]),
  availability_start_date: z.iso.date().nullable().default(null),
  short_bio: nullableText(5000),
  has_no_employment_history: z.boolean().default(false),

  // Compatibility fields retained until the worker consumes normalized data.
  location: nullableText(500),
  school: nullableText(500),
  degree: nullableText(500),
  linkedin_url: nullableUrl,
  github_url: nullableUrl,
  portfolio_url: nullableUrl,

  created_at: postgresTimestampSchema,
  updated_at: postgresTimestampSchema,
});

const applicantProfileInputShape = {
  first_name: z.string().trim().min(1).max(100),
  last_name: z.string().trim().min(1).max(100),
  preferred_name: nullableText(100),
  email: z.email(),
  phone: nullableText(100),
  address_line_1: nullableText(250),
  address_line_2: nullableText(250),
  city: nullableText(150),
  state_province: nullableText(150),
  postal_code: nullableText(30),
  country: nullableText(100),
  timezone: nullableText(100),
  graduation_date: nullableText(100),
  work_authorization: nullableText(500),
  requires_sponsorship: z.boolean().nullable().default(null),
  willing_to_relocate: z.boolean().nullable().default(null),
  preferred_locations: z.array(z.string().trim().min(1).max(150)).default([]),
  availability_start_date: z.iso.date().nullable().default(null),
  short_bio: nullableText(5000),
  has_no_employment_history: z.boolean().default(false),
};

export const applicantProfileInputSchema = z.object(applicantProfileInputShape);
export const applicantProfilePatchSchema = z.object(applicantProfileInputShape).partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: "At least one profile field is required." },
);

export const profileEducationSchema = z.object({
  id: z.uuid(),
  profile_id: z.uuid(),
  school: z.string().trim().min(1).max(250),
  degree: nullableText(250),
  field_of_study: nullableText(250),
  start_month: nullableMonth,
  start_year: nullableYear,
  end_month: nullableMonth,
  end_year: nullableYear,
  is_current: z.boolean().default(false),
  gpa: nullableText(50),
  location: nullableText(250),
  created_at: postgresTimestampSchema,
  updated_at: postgresTimestampSchema,
});

const profileEducationInputShape = {
  school: z.string().trim().min(1).max(250),
  degree: nullableText(250),
  field_of_study: nullableText(250),
  start_month: nullableMonth,
  start_year: nullableYear,
  end_month: nullableMonth,
  end_year: nullableYear,
  is_current: z.boolean().default(false),
  gpa: nullableText(50),
  location: nullableText(250),
};

export const profileEducationInputSchema = z.object(profileEducationInputShape);
export const profileEducationPatchSchema = z.object(profileEducationInputShape).partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: "At least one education field is required." },
);

export const profileEmploymentSchema = z.object({
  id: z.uuid(),
  profile_id: z.uuid(),
  company: z.string().trim().min(1).max(250),
  title: z.string().trim().min(1).max(250),
  location: nullableText(250),
  start_month: nullableMonth,
  start_year: nullableYear,
  end_month: nullableMonth,
  end_year: nullableYear,
  is_current: z.boolean().default(false),
  description: nullableText(5000),
  created_at: postgresTimestampSchema,
  updated_at: postgresTimestampSchema,
});

const profileEmploymentInputShape = {
  company: z.string().trim().min(1).max(250),
  title: z.string().trim().min(1).max(250),
  location: nullableText(250),
  start_month: nullableMonth,
  start_year: nullableYear,
  end_month: nullableMonth,
  end_year: nullableYear,
  is_current: z.boolean().default(false),
  description: nullableText(5000),
};

export const profileEmploymentInputSchema = z.object(profileEmploymentInputShape);
export const profileEmploymentPatchSchema = z.object(profileEmploymentInputShape).partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: "At least one employment field is required." },
);

export const profileLinkSchema = z.object({
  id: z.uuid(),
  profile_id: z.uuid(),
  type: profileLinkTypeSchema,
  label: nullableText(100),
  url: z.url(),
  created_at: postgresTimestampSchema,
  updated_at: postgresTimestampSchema,
});

const profileLinkInputShape = {
  type: profileLinkTypeSchema,
  label: nullableText(100),
  url: z.url(),
};

export const profileLinkInputSchema = z.object(profileLinkInputShape);
export const profileLinkPatchSchema = z.object(profileLinkInputShape).partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: "At least one link field is required." },
);

export const profileDocumentSchema = z.object({
  id: z.uuid(),
  profile_id: z.uuid(),
  type: profileDocumentTypeSchema,
  storage_path: z.string().min(1),
  filename: z.string().min(1).max(255),
  mime_type: z.string().nullable(),
  file_size_bytes: z.number().int().nonnegative().nullable(),
  is_primary: z.boolean(),
  created_at: postgresTimestampSchema,
  updated_at: postgresTimestampSchema,
});

export const deleteProfileDocumentSchema = z.object({ id: z.uuid() });

export const applicantProfileBundleSchema = z.object({
  profile: applicantProfileSchema,
  educations: z.array(profileEducationSchema),
  employments: z.array(profileEmploymentSchema),
  links: z.array(profileLinkSchema),
  documents: z.array(profileDocumentSchema),
});

export type ApplicantProfile = z.infer<typeof applicantProfileSchema>;
export type ApplicantProfileInput = z.infer<typeof applicantProfileInputSchema>;
export type ApplicantProfilePatch = z.infer<typeof applicantProfilePatchSchema>;
export type ProfileEducation = z.infer<typeof profileEducationSchema>;
export type ProfileEducationInput = z.infer<typeof profileEducationInputSchema>;
export type ProfileEmployment = z.infer<typeof profileEmploymentSchema>;
export type ProfileEmploymentInput = z.infer<typeof profileEmploymentInputSchema>;
export type ProfileLink = z.infer<typeof profileLinkSchema>;
export type ProfileLinkInput = z.infer<typeof profileLinkInputSchema>;
export type ProfileLinkType = z.infer<typeof profileLinkTypeSchema>;
export type ProfileDocument = z.infer<typeof profileDocumentSchema>;
export type ProfileDocumentType = z.infer<typeof profileDocumentTypeSchema>;
export type ApplicantProfileBundle = z.infer<typeof applicantProfileBundleSchema>;
