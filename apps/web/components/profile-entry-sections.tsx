"use client";

import { useState, type FormEvent } from "react";
import { BriefcaseBusiness, GraduationCap, Link2, Pencil, Plus, Trash2, X } from "lucide-react";
import type {
  ProfileEducation,
  ProfileEducationInput,
  ProfileEmployment,
  ProfileEmploymentInput,
  ProfileLink,
  ProfileLinkInput,
  ProfileLinkType,
} from "@applyqueue/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/utils";

type SectionProps = { onChanged: () => Promise<void>; onError: (message: string) => void };

const selectClass = "h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";
const labelClass = "mb-2 block text-sm font-semibold text-slate-700";
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function dateLabel(startMonth: number | null, startYear: number | null, endMonth: number | null, endYear: number | null, current: boolean) {
  const format = (month: number | null, year: number | null) => [month ? months[month - 1] : null, year].filter(Boolean).join(" ");
  return `${format(startMonth, startYear) || "Start not set"} – ${current ? "Present" : format(endMonth, endYear) || "End not set"}`;
}

function MonthYearFields({
  prefix,
  month,
  year,
  disabled = false,
  onMonth,
  onYear,
}: {
  prefix: string;
  month: number | null;
  year: number | null;
  disabled?: boolean;
  onMonth: (value: number | null) => void;
  onYear: (value: number | null) => void;
}) {
  return (
    <div>
      <span className={labelClass}>{prefix}</span>
      <div className="grid grid-cols-2 gap-2">
        <select className={selectClass} disabled={disabled} value={month ?? ""} onChange={(event) => onMonth(event.target.value ? Number(event.target.value) : null)}>
          <option value="">Month</option>{months.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
        </select>
        <Input disabled={disabled} inputMode="numeric" placeholder="Year" value={year ?? ""} onChange={(event) => onYear(event.target.value ? Number(event.target.value) : null)} />
      </div>
    </div>
  );
}

const emptyEducation: ProfileEducationInput = {
  school: "", degree: null, field_of_study: null, start_month: null, start_year: null,
  end_month: null, end_year: null, is_current: false, gpa: null, location: null,
};

export function EducationSection({ entries, onChanged, onError }: SectionProps & { entries: ProfileEducation[] }) {
  const [editing, setEditing] = useState<ProfileEducation | "new" | null>(null);
  const [draft, setDraft] = useState<ProfileEducationInput>(emptyEducation);
  const [saving, setSaving] = useState(false);

  function open(entry?: ProfileEducation) {
    setEditing(entry ?? "new");
    setDraft(entry ? {
      school: entry.school, degree: entry.degree, field_of_study: entry.field_of_study,
      start_month: entry.start_month, start_year: entry.start_year, end_month: entry.end_month,
      end_year: entry.end_year, is_current: entry.is_current, gpa: entry.gpa, location: entry.location,
    } : emptyEducation);
  }

  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true);
    try {
      const path = editing === "new" ? "/api/profile/educations" : `/api/profile/educations/${editing?.id}`;
      await api(path, { method: editing === "new" ? "POST" : "PATCH", body: JSON.stringify(draft) });
      setEditing(null); await onChanged();
    } catch (error) { onError(error instanceof Error ? error.message : "Could not save education"); }
    finally { setSaving(false); }
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this education entry?")) return;
    try { await api(`/api/profile/educations/${id}`, { method: "DELETE" }); await onChanged(); }
    catch (error) { onError(error instanceof Error ? error.message : "Could not delete education"); }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4"><div><div className="flex items-center gap-2"><GraduationCap className="size-5 text-indigo-600" /><h2 className="font-bold">Education</h2></div><p className="mt-1 text-sm text-slate-500">Degrees and schools used for ATS autofill.</p></div><Button type="button" size="sm" variant="outline" onClick={() => open()}><Plus className="size-4" />Add</Button></CardHeader>
      <CardContent className="space-y-3">
        {entries.length === 0 && !editing && <EmptyState text="Add your education history for ATS autofill." />}
        {entries.map((entry) => <EntryRow key={entry.id} title={entry.school} subtitle={[entry.degree, entry.field_of_study].filter(Boolean).join(" · ") || "Degree not specified"} meta={dateLabel(entry.start_month, entry.start_year, entry.end_month, entry.end_year, entry.is_current)} onEdit={() => open(entry)} onDelete={() => void remove(entry.id)} />)}
        {editing && <form onSubmit={save} className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4"><EditorHeader title={editing === "new" ? "Add education" : "Edit education"} onClose={() => setEditing(null)} /><div className="grid gap-4 sm:grid-cols-2"><Field label="School" required value={draft.school} onChange={(value) => setDraft({ ...draft, school: value })} /><Field label="Degree" value={draft.degree} onChange={(value) => setDraft({ ...draft, degree: value || null })} /><Field label="Field of study" value={draft.field_of_study} onChange={(value) => setDraft({ ...draft, field_of_study: value || null })} /><Field label="Location" value={draft.location} onChange={(value) => setDraft({ ...draft, location: value || null })} /><MonthYearFields prefix="Start" month={draft.start_month} year={draft.start_year} onMonth={(value) => setDraft({ ...draft, start_month: value })} onYear={(value) => setDraft({ ...draft, start_year: value })} /><MonthYearFields prefix="End" month={draft.end_month} year={draft.end_year} disabled={draft.is_current} onMonth={(value) => setDraft({ ...draft, end_month: value })} onYear={(value) => setDraft({ ...draft, end_year: value })} /><Field label="GPA" value={draft.gpa} onChange={(value) => setDraft({ ...draft, gpa: value || null })} /><label className="flex items-center gap-2 pt-8 text-sm font-medium text-slate-700"><input type="checkbox" checked={draft.is_current} onChange={(event) => setDraft({ ...draft, is_current: event.target.checked, end_month: null, end_year: null })} />Currently studying here</label></div><EditorActions saving={saving} onCancel={() => setEditing(null)} /></form>}
      </CardContent>
    </Card>
  );
}

const emptyEmployment: ProfileEmploymentInput = {
  company: "", title: "", location: null, start_month: null, start_year: null,
  end_month: null, end_year: null, is_current: false, description: null,
};

export function EmploymentSection({ entries, explicitlyEmpty, onExplicitlyEmpty, onChanged, onError }: SectionProps & { entries: ProfileEmployment[]; explicitlyEmpty: boolean; onExplicitlyEmpty: (value: boolean) => void }) {
  const [editing, setEditing] = useState<ProfileEmployment | "new" | null>(null);
  const [draft, setDraft] = useState<ProfileEmploymentInput>(emptyEmployment);
  const [saving, setSaving] = useState(false);

  function open(entry?: ProfileEmployment) {
    setEditing(entry ?? "new");
    setDraft(entry ? { company: entry.company, title: entry.title, location: entry.location, start_month: entry.start_month, start_year: entry.start_year, end_month: entry.end_month, end_year: entry.end_year, is_current: entry.is_current, description: entry.description } : emptyEmployment);
  }

  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true);
    try {
      const path = editing === "new" ? "/api/profile/employments" : `/api/profile/employments/${editing?.id}`;
      await api(path, { method: editing === "new" ? "POST" : "PATCH", body: JSON.stringify(draft) });
      setEditing(null); onExplicitlyEmpty(false); await onChanged();
    } catch (error) { onError(error instanceof Error ? error.message : "Could not save employment"); }
    finally { setSaving(false); }
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this employment entry?")) return;
    try { await api(`/api/profile/employments/${id}`, { method: "DELETE" }); await onChanged(); }
    catch (error) { onError(error instanceof Error ? error.message : "Could not delete employment"); }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4"><div><div className="flex items-center gap-2"><BriefcaseBusiness className="size-5 text-indigo-600" /><h2 className="font-bold">Employment</h2></div><p className="mt-1 text-sm text-slate-500">Work history and résumé-style descriptions.</p></div><Button type="button" size="sm" variant="outline" onClick={() => open()}><Plus className="size-4" />Add</Button></CardHeader>
      <CardContent className="space-y-3">
        {entries.length === 0 && !editing && <><EmptyState text="Add employment history, or mark that you have no prior experience." /><label className="flex items-center gap-2 text-sm font-medium text-slate-700"><input type="checkbox" checked={explicitlyEmpty} onChange={(event) => onExplicitlyEmpty(event.target.checked)} />I have no employment history yet</label></>}
        {entries.map((entry) => <EntryRow key={entry.id} title={entry.title} subtitle={entry.company} meta={`${dateLabel(entry.start_month, entry.start_year, entry.end_month, entry.end_year, entry.is_current)}${entry.location ? ` · ${entry.location}` : ""}`} description={entry.description} onEdit={() => open(entry)} onDelete={() => void remove(entry.id)} />)}
        {editing && <form onSubmit={save} className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4"><EditorHeader title={editing === "new" ? "Add employment" : "Edit employment"} onClose={() => setEditing(null)} /><div className="grid gap-4 sm:grid-cols-2"><Field label="Company" required value={draft.company} onChange={(value) => setDraft({ ...draft, company: value })} /><Field label="Title" required value={draft.title} onChange={(value) => setDraft({ ...draft, title: value })} /><Field label="Location" value={draft.location} onChange={(value) => setDraft({ ...draft, location: value || null })} /><label className="flex items-center gap-2 pt-8 text-sm font-medium text-slate-700"><input type="checkbox" checked={draft.is_current} onChange={(event) => setDraft({ ...draft, is_current: event.target.checked, end_month: null, end_year: null })} />I currently work here</label><MonthYearFields prefix="Start" month={draft.start_month} year={draft.start_year} onMonth={(value) => setDraft({ ...draft, start_month: value })} onYear={(value) => setDraft({ ...draft, start_year: value })} /><MonthYearFields prefix="End" month={draft.end_month} year={draft.end_year} disabled={draft.is_current} onMonth={(value) => setDraft({ ...draft, end_month: value })} onYear={(value) => setDraft({ ...draft, end_year: value })} /><label className="sm:col-span-2"><span className={labelClass}>Description</span><Textarea placeholder="Describe your work, impact, and responsibilities." value={draft.description ?? ""} onChange={(event) => setDraft({ ...draft, description: event.target.value || null })} /></label></div><EditorActions saving={saving} onCancel={() => setEditing(null)} /></form>}
      </CardContent>
    </Card>
  );
}

const emptyLink: ProfileLinkInput = { type: "LINKEDIN", label: null, url: "" };

export function LinksSection({ entries, onChanged, onError }: SectionProps & { entries: ProfileLink[] }) {
  const [editing, setEditing] = useState<ProfileLink | "new" | null>(null);
  const [draft, setDraft] = useState<ProfileLinkInput>(emptyLink);
  const [saving, setSaving] = useState(false);
  function open(entry?: ProfileLink) { setEditing(entry ?? "new"); setDraft(entry ? { type: entry.type, label: entry.label, url: entry.url } : emptyLink); }
  async function save(event: FormEvent) { event.preventDefault(); setSaving(true); try { const path = editing === "new" ? "/api/profile/links" : `/api/profile/links/${editing?.id}`; await api(path, { method: editing === "new" ? "POST" : "PATCH", body: JSON.stringify(draft) }); setEditing(null); await onChanged(); } catch (error) { onError(error instanceof Error ? error.message : "Could not save link"); } finally { setSaving(false); } }
  async function remove(id: string) { if (!window.confirm("Delete this profile link?")) return; try { await api(`/api/profile/links/${id}`, { method: "DELETE" }); await onChanged(); } catch (error) { onError(error instanceof Error ? error.message : "Could not delete link"); } }
  return <Card><CardHeader className="flex-row items-start justify-between gap-4"><div><div className="flex items-center gap-2"><Link2 className="size-5 text-indigo-600" /><h2 className="font-bold">Online profiles</h2></div><p className="mt-1 text-sm text-slate-500">Professional profiles and personal sites.</p></div><Button type="button" size="sm" variant="outline" onClick={() => open()}><Plus className="size-4" />Add</Button></CardHeader><CardContent className="space-y-3">{entries.length === 0 && !editing && <EmptyState text="Add at least one professional profile." />}{entries.map((entry) => <EntryRow key={entry.id} title={entry.label || entry.type.replaceAll("_", " ")} subtitle={entry.url} onEdit={() => open(entry)} onDelete={() => void remove(entry.id)} />)}{editing && <form onSubmit={save} className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4"><EditorHeader title={editing === "new" ? "Add link" : "Edit link"} onClose={() => setEditing(null)} /><div className="grid gap-4 sm:grid-cols-3"><label><span className={labelClass}>Type</span><select className={selectClass} value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as ProfileLinkType })}>{["LINKEDIN", "GITHUB", "PORTFOLIO", "PERSONAL_WEBSITE", "OTHER"].map((type) => <option key={type}>{type}</option>)}</select></label><Field label="Label" value={draft.label} onChange={(value) => setDraft({ ...draft, label: value || null })} /><Field label="URL" required type="url" value={draft.url} onChange={(value) => setDraft({ ...draft, url: value })} /></div><EditorActions saving={saving} onCancel={() => setEditing(null)} /></form>}</CardContent></Card>;
}

function EmptyState({ text }: { text: string }) { return <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">{text}</div>; }
function EditorHeader({ title, onClose }: { title: string; onClose: () => void }) { return <div className="mb-4 flex items-center justify-between"><h3 className="font-semibold">{title}</h3><button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700"><X className="size-4" /></button></div>; }
function EditorActions({ saving, onCancel }: { saving: boolean; onCancel: () => void }) { return <div className="mt-4 flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button></div>; }
function Field({ label, value, onChange, required = false, type = "text" }: { label: string; value: string | null; onChange: (value: string) => void; required?: boolean; type?: string }) { return <label><span className={labelClass}>{label}</span><Input type={type} required={required} value={value ?? ""} onChange={(event) => onChange(event.target.value)} /></label>; }
function EntryRow({ title, subtitle, meta, description, onEdit, onDelete }: { title: string; subtitle: string; meta?: string; description?: string | null; onEdit: () => void; onDelete: () => void }) { return <div className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 p-4"><div className="min-w-0"><h3 className="font-semibold text-slate-900">{title}</h3><p className="mt-0.5 break-words text-sm text-slate-600">{subtitle}</p>{meta && <p className="mt-1 text-xs text-slate-400">{meta}</p>}{description && <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">{description}</p>}</div><div className="flex shrink-0 gap-1"><Button type="button" size="sm" variant="ghost" onClick={onEdit}><Pencil className="size-3.5" /><span className="sr-only">Edit</span></Button><Button type="button" size="sm" variant="ghost" className="text-red-600 hover:text-red-700" onClick={onDelete}><Trash2 className="size-3.5" /><span className="sr-only">Delete</span></Button></div></div>; }
