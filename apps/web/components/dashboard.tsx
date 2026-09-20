"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, CircleAlert, CircleCheck, ExternalLink, LoaderCircle, Plus, Sparkles } from "lucide-react";
import type { Application } from "@applyqueue/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/status-badge";
import { api } from "@/lib/utils";

export function Dashboard() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [startingId, setStartingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await api<{ applications: Application[] }>("/api/applications");
      setApplications(result.applications);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load the queue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => void load(), 2000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [load]);

  async function addApplication(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      await api("/api/applications", { method: "POST", body: JSON.stringify({ url }) });
      setUrl("");
      await load();
      setNotice("Job added to the queue.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not add the job");
    } finally {
      setSubmitting(false);
    }
  }

  async function start(id: string) {
    if (startingId) return;
    setStartingId(id);
    setError(null);
    setNotice(null);
    try {
      await api(`/api/applications/${id}/start`, { method: "POST" });
      await load();
      setNotice("Application started. Open its detail page to watch progress.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not start the job");
    } finally {
      setStartingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <section className="mb-10 grid gap-8 lg:grid-cols-[1fr_22rem] lg:items-end">
        <div>
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-indigo-600"><Sparkles className="size-4" /> Your application copilot</div>
          <h1 className="max-w-2xl text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">Turn job applications into a queue.</h1>
          <p className="mt-4 max-w-xl text-lg leading-8 text-slate-600">Add a role, let the browser fill what it safely knows, then review every answer before anything is submitted.</p>
        </div>
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-5 text-sm text-indigo-950">
          <div className="font-semibold">You stay in control</div>
          <p className="mt-1 leading-6 text-indigo-800">ApplyQueue never clicks the final submit button in this MVP.</p>
        </div>
      </section>

      <Card className="mb-8 border-indigo-100 shadow-md shadow-indigo-100/40">
        <CardContent className="p-4 sm:p-5">
          <form onSubmit={addApplication} className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <BriefcaseBusiness className="absolute left-3.5 top-3.5 size-4 text-slate-400" />
              <Input className="pl-10" type="url" required placeholder="Paste an Ashby, Greenhouse, or Lever job URL" value={url} onChange={(event) => setUrl(event.target.value)} />
            </div>
            <Button className="h-11" type="submit" disabled={submitting || !url.trim()}>
              {submitting ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />} Add to Queue
            </Button>
          </form>
        </CardContent>
      </Card>

      {error && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <CircleAlert className="mt-0.5 size-4 shrink-0" /><span>{error}</span>
        </div>
      )}

      {notice && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <CircleCheck className="mt-0.5 size-4 shrink-0" /><span>{notice}</span>
        </div>
      )}

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-950">Application queue</h2>
        <span className="text-sm text-slate-500">{applications.length} {applications.length === 1 ? "role" : "roles"}</span>
      </div>

      {loading ? (
        <div className="grid h-48 place-items-center text-slate-500"><LoaderCircle className="size-6 animate-spin" /></div>
      ) : applications.length === 0 ? (
        <Card className="border-dashed shadow-none">
          <CardContent className="grid min-h-64 place-items-center text-center">
            <div><span className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-slate-100"><BriefcaseBusiness className="size-5 text-slate-500" /></span><h3 className="font-semibold">Your queue is empty</h3><p className="mt-1 text-sm text-slate-500">Paste a public job posting above to get started.</p></div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {applications.map((application) => (
            <Card key={application.id} className="overflow-hidden transition hover:border-slate-300 hover:shadow-md">
              <CardContent className="p-5">
                <div className="grid gap-5 md:grid-cols-[1fr_12rem_auto] md:items-center">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2"><StatusBadge status={application.status} /><span className="text-xs text-slate-400">{new Date(application.created_at).toLocaleString()}</span></div>
                    <h3 className="truncate font-bold capitalize text-slate-950">{application.role || "Untitled role"}</h3>
                    <div className="mt-1 flex items-center gap-2 text-sm text-slate-500"><span className="capitalize">{application.company || "Unknown company"}</span><span>·</span><a className="inline-flex items-center gap-1 hover:text-indigo-600" href={application.url} target="_blank" rel="noreferrer">Job post <ExternalLink className="size-3" /></a></div>
                  </div>
                  <div><div className="mb-2 flex justify-between text-xs font-medium text-slate-500"><span>Progress</span><span>{application.progress}%</span></div><Progress value={application.progress} /></div>
                  <div className="flex justify-end">
                    {application.status === "QUEUED" && !application.processing_requested_at ? (
                      <Button size="sm" disabled={startingId !== null} onClick={() => void start(application.id)}>
                        {startingId === application.id ? <LoaderCircle className="size-3.5 animate-spin" /> : <>Start <ArrowRight className="size-3.5" /></>}
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" asChild><Link href={`/applications/${application.id}`}>{application.status === "NEEDS_INPUT" ? "Answer" : application.status === "READY_FOR_REVIEW" ? "Review" : "View"}<ArrowRight className="size-3.5" /></Link></Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
