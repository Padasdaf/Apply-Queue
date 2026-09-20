"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  CalendarClock,
  Check,
  CircleAlert,
  CircleCheck,
  LoaderCircle,
  MapPin,
  Save,
  Sparkles,
  UserRound,
} from "lucide-react";
import {
  calculateProfileCompleteness,
  type ApplicantProfileBundle,
  type ApplicantProfileInput,
  type ProfileCompleteness,
} from "@applyqueue/shared";
import { EducationSection, EmploymentSection, LinksSection } from "@/components/profile-entry-sections";
import { ProfileResumeSection } from "@/components/profile-resume-section";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/utils";

type ProfileResponse = ApplicantProfileBundle & { completeness: ProfileCompleteness };

const emptyProfile: ApplicantProfileInput = {
  first_name: "",
  last_name: "",
  preferred_name: null,
  email: "",
  phone: null,
  address_line_1: null,
  address_line_2: null,
  city: null,
  state_province: null,
  postal_code: null,
  country: null,
  timezone: null,
  graduation_date: null,
  work_authorization: null,
  requires_sponsorship: null,
  willing_to_relocate: null,
  preferred_locations: [],
  availability_start_date: null,
  short_bio: null,
  has_no_employment_history: false,
};

const selectClass = "h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";
const labelClass = "mb-2 block text-sm font-semibold text-slate-700";

function toInput(profile: ApplicantProfileBundle["profile"]): ApplicantProfileInput {
  return {
    first_name: profile.first_name,
    last_name: profile.last_name,
    preferred_name: profile.preferred_name,
    email: profile.email,
    phone: profile.phone,
    address_line_1: profile.address_line_1,
    address_line_2: profile.address_line_2,
    city: profile.city,
    state_province: profile.state_province,
    postal_code: profile.postal_code,
    country: profile.country,
    timezone: profile.timezone,
    graduation_date: profile.graduation_date,
    work_authorization: profile.work_authorization,
    requires_sponsorship: profile.requires_sponsorship,
    willing_to_relocate: profile.willing_to_relocate,
    preferred_locations: profile.preferred_locations,
    availability_start_date: profile.availability_start_date,
    short_bio: profile.short_bio,
    has_no_employment_history: profile.has_no_employment_history,
  };
}

export function ProfileForm() {
  const [bundle, setBundle] = useState<ProfileResponse | null>(null);
  const [profile, setProfile] = useState<ApplicantProfileInput>(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async (preserveDraft = false) => {
    const loaded = await api<ProfileResponse>("/api/profile");
    setBundle(loaded);
    if (!preserveDraft) setProfile(toInput(loaded.profile));
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => {
      load().catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load profile"))
        .finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(initial);
  }, [load]);

  const completeness = useMemo(() => {
    if (!bundle) return null;
    return calculateProfileCompleteness({ ...bundle, profile: { ...bundle.profile, ...profile } });
  }, [bundle, profile]);

  function update<K extends keyof ApplicantProfileInput>(key: K, value: ApplicantProfileInput[K]) {
    setSaved(false);
    setNotice(null);
    setProfile((current) => ({ ...current, [key]: value }));
  }

  function showError(message: string) {
    setNotice(null);
    setError(message);
  }

  function showNotice(message: string) {
    setError(null);
    setNotice(message);
  }

  async function refreshNested() {
    setError(null);
    await load(true);
  }

  async function save() {
    setSaving(true);
    setSaved(false);
    setError(null);
    setNotice(null);
    try {
      const payload = {
        ...profile,
        preferred_locations: profile.preferred_locations.map((value) => value.trim()).filter(Boolean),
      };
      await api("/api/profile", { method: "PATCH", body: JSON.stringify(payload) });
      await load();
      setSaved(true);
      setNotice("Profile saved.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save profile");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="grid min-h-[60vh] place-items-center"><div className="text-center"><LoaderCircle className="mx-auto size-7 animate-spin text-indigo-600" /><p className="mt-3 text-sm text-slate-500">Loading your profile…</p></div></div>;
  }

  if (!bundle) {
    return <div className="mx-auto max-w-3xl px-5 py-16"><div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">{error ?? "Could not load profile."}</div></div>;
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-10 sm:py-12">
      <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
        <div className="flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-indigo-100 text-indigo-700"><UserRound className="size-6" /></span>
          <div><h1 className="text-3xl font-bold tracking-tight">Applicant profile</h1><p className="mt-2 max-w-2xl text-slate-600">Save your application facts once. ApplyQueue only uses information you explicitly provide.</p></div>
        </div>
        {completeness && <div className="w-full rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:w-64"><div className="mb-2 flex items-center justify-between"><span className="text-sm font-semibold text-slate-700">Profile completeness</span><span className="text-sm font-bold text-indigo-700">{completeness.percentage}%</span></div><Progress value={completeness.percentage} /><p className="mt-2 text-xs text-slate-500">{completeness.completed} of {completeness.total} application essentials complete.</p></div>}
      </div>

      {error && <div className="mb-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><CircleAlert className="mt-0.5 size-4 shrink-0" />{error}</div>}
      {notice && <div className="mb-5 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><CircleCheck className="mt-0.5 size-4 shrink-0" />{notice}</div>}

      <div className="space-y-5">
        <SectionCard icon={<UserRound className="size-5 text-indigo-600" />} title="Personal information" description="The name and contact details employers use to reach you.">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <TextField label="First name" required value={profile.first_name} onChange={(value) => update("first_name", value)} />
            <TextField label="Last name" required value={profile.last_name} onChange={(value) => update("last_name", value)} />
            <TextField label="Preferred name" value={profile.preferred_name} onChange={(value) => update("preferred_name", value || null)} />
            <TextField label="Email" required type="email" value={profile.email} onChange={(value) => update("email", value)} />
            <TextField label="Phone" type="tel" value={profile.phone} onChange={(value) => update("phone", value || null)} />
          </div>
        </SectionCard>

        <SectionCard icon={<MapPin className="size-5 text-indigo-600" />} title="Location" description="Your current address and timezone. Leave anything you do not want to save blank.">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <div className="sm:col-span-2"><TextField label="Address line 1" value={profile.address_line_1} onChange={(value) => update("address_line_1", value || null)} /></div>
            <TextField label="Address line 2" value={profile.address_line_2} onChange={(value) => update("address_line_2", value || null)} />
            <TextField label="City" value={profile.city} onChange={(value) => update("city", value || null)} />
            <TextField label="State / province" value={profile.state_province} onChange={(value) => update("state_province", value || null)} />
            <TextField label="Postal code" value={profile.postal_code} onChange={(value) => update("postal_code", value || null)} />
            <TextField label="Country" value={profile.country} onChange={(value) => update("country", value || null)} />
            <TextField label="Timezone" placeholder="America/Toronto" value={profile.timezone} onChange={(value) => update("timezone", value || null)} />
          </div>
        </SectionCard>

        <ProfileResumeSection documents={bundle.documents} onChanged={refreshNested} onError={showError} onNotice={showNotice} />
        <EducationSection entries={bundle.educations} onChanged={refreshNested} onError={showError} />
        <EmploymentSection entries={bundle.employments} explicitlyEmpty={profile.has_no_employment_history} onExplicitlyEmpty={(value) => update("has_no_employment_history", value)} onChanged={refreshNested} onError={showError} />
        <LinksSection entries={bundle.links} onChanged={refreshNested} onError={showError} />

        <SectionCard icon={<CalendarClock className="size-5 text-indigo-600" />} title="Application details" description="Facts commonly requested by application forms. Unanswered values stay unknown.">
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField label="Graduation date" placeholder="May 2027" value={profile.graduation_date} onChange={(value) => update("graduation_date", value || null)} />
            <TextField label="Availability start date" type="date" value={profile.availability_start_date} onChange={(value) => update("availability_start_date", value || null)} />
            <div className="sm:col-span-2"><TextField label="Work authorization" placeholder="e.g. Authorized to work in Canada" value={profile.work_authorization} onChange={(value) => update("work_authorization", value || null)} /></div>
            <BooleanSelect label="Requires sponsorship" value={profile.requires_sponsorship} onChange={(value) => update("requires_sponsorship", value)} />
            <BooleanSelect label="Willing to relocate" value={profile.willing_to_relocate} onChange={(value) => update("willing_to_relocate", value)} />
            <label className="sm:col-span-2"><span className={labelClass}>Preferred locations</span><Input placeholder="Toronto, New York, Remote" value={profile.preferred_locations.join(", ")} onChange={(event) => update("preferred_locations", event.target.value.split(","))} /><span className="mt-1.5 block text-xs text-slate-400">Separate multiple locations with commas.</span></label>
          </div>
        </SectionCard>

        <SectionCard icon={<Sparkles className="size-5 text-indigo-600" />} title="About you" description="A reusable short introduction for application questions.">
          <label><span className={labelClass}>Short bio</span><Textarea rows={5} maxLength={5000} placeholder="Summarize your background, interests, and the kind of work you are looking for." value={profile.short_bio ?? ""} onChange={(event) => update("short_bio", event.target.value || null)} /><span className="mt-1.5 block text-right text-xs text-slate-400">{profile.short_bio?.length ?? 0} / 5000</span></label>
        </SectionCard>

        {completeness && completeness.percentage < 100 && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-sm font-semibold text-amber-900">Still useful to add</p><p className="mt-1 text-sm text-amber-800">{completeness.items.filter((item) => !item.complete).map((item) => item.label).join(" · ")}</p></div>}

        <div className="sticky bottom-4 flex items-center justify-end gap-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur">
          {saved && <span className="flex items-center gap-1 text-sm font-medium text-emerald-700"><Check className="size-4" />Saved</span>}
          <Button type="button" size="lg" disabled={saving} onClick={() => void save()}>{saving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}Save profile</Button>
        </div>
      </div>
    </div>
  );
}

function SectionCard({ icon, title, description, children }: { icon: ReactNode; title: string; description: string; children: ReactNode }) {
  return <Card><CardHeader><div className="flex items-center gap-2">{icon}<h2 className="font-bold">{title}</h2></div><p className="mt-1 text-sm text-slate-500">{description}</p></CardHeader><CardContent>{children}</CardContent></Card>;
}

function TextField({ label, value, onChange, required = false, type = "text", placeholder }: { label: string; value: string | null; onChange: (value: string) => void; required?: boolean; type?: string; placeholder?: string }) {
  return <label><span className={labelClass}>{label}</span><Input type={type} required={required} placeholder={placeholder} value={value ?? ""} onChange={(event) => onChange(event.target.value)} /></label>;
}

function BooleanSelect({ label, value, onChange }: { label: string; value: boolean | null; onChange: (value: boolean | null) => void }) {
  return <label><span className={labelClass}>{label}</span><select className={selectClass} value={value === null ? "" : String(value)} onChange={(event) => onChange(event.target.value === "" ? null : event.target.value === "true")}><option value="">Not answered</option><option value="false">No</option><option value="true">Yes</option></select></label>;
}
