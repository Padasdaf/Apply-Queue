"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Bot, Check, CircleAlert, Clock3, ExternalLink, LoaderCircle, MonitorPlay, Send } from "lucide-react";
import type { Application, ApplicationEvent, ApplicationQuestion } from "@applyqueue/shared";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/utils";

type Detail = { application: Application; events: ApplicationEvent[]; questions: ApplicationQuestion[] };

export function ApplicationDetail({ id }: { id: string }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [savingQuestionId, setSavingQuestionId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setDetail(await api<Detail>(`/api/applications/${id}`));
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load application");
    }
  }, [id]);

  useEffect(() => {
    const initial = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => void load(), 1500);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [load]);

  async function saveAnswer(question: ApplicationQuestion) {
    const answer = answers[question.id];
    if (!answer?.trim() || savingQuestionId) return;
    setSavingQuestionId(question.id);
    try {
      await api(`/api/questions/${question.id}`, { method: "PATCH", body: JSON.stringify({ answer }) });
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save answer");
    } finally {
      setSavingQuestionId(null);
    }
  }

  if (!detail) return <div className="grid min-h-[65vh] place-items-center">{error ? <p className="text-red-700">{error}</p> : <LoaderCircle className="size-7 animate-spin text-indigo-600" />}</div>;
  const { application, events, questions } = detail;

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <Button variant="ghost" size="sm" asChild className="mb-6 -ml-2"><Link href="/"><ArrowLeft className="size-4" />Back to queue</Link></Button>
      <div className="mb-8 grid gap-6 md:grid-cols-[1fr_auto] md:items-start">
        <div><div className="mb-3 flex flex-wrap items-center gap-3"><StatusBadge status={application.status} /><span className="text-sm text-slate-500">Added {new Date(application.created_at).toLocaleString()}</span></div><h1 className="text-3xl font-bold capitalize tracking-tight">{application.role || "Untitled role"}</h1><a className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium capitalize text-slate-600 hover:text-indigo-600" href={application.url} target="_blank" rel="noreferrer">{application.company || "Unknown company"}<ExternalLink className="size-3.5" /></a></div>
        {application.browserbase_session_url && <Button asChild><a href={application.browserbase_session_url} target="_blank" rel="noreferrer"><MonitorPlay className="size-4" />Watch browser</a></Button>}
      </div>

      {error && <div className="mb-5 flex gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><CircleAlert className="size-4" />{error}</div>}
      {application.error_message && <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4"><div className="flex items-center gap-2 font-semibold text-red-800"><CircleAlert className="size-4" />Worker error</div><p className="mt-2 text-sm text-red-700">{application.error_message}</p></div>}

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex-row items-center justify-between"><div><h2 className="font-bold">Progress</h2><p className="mt-1 text-sm text-slate-500">The page refreshes automatically while the worker runs.</p></div><span className="text-2xl font-bold text-indigo-600">{application.progress}%</span></CardHeader>
            <CardContent><Progress value={application.progress} className="h-2" /></CardContent>
          </Card>

          {questions.length > 0 && <Card className="border-amber-200"><CardHeader><h2 className="font-bold">Questions needing your input</h2><p className="mt-1 text-sm text-slate-500">Answers are saved for review. Automatic browser resumption is the next milestone.</p></CardHeader><CardContent className="space-y-4">{questions.map((question) => <div key={question.id} className="rounded-xl border border-slate-200 p-4"><div className="mb-3 flex items-start justify-between gap-3"><label className="text-sm font-semibold text-slate-800" htmlFor={question.id}>{question.question}</label>{question.status === "ANSWERED_BY_USER" && <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700"><Check className="size-3.5" />Saved</span>}</div><div className="flex gap-2"><Input id={question.id} defaultValue={question.answer ?? ""} onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))} /><Button variant="outline" disabled={savingQuestionId !== null} onClick={() => void saveAnswer(question)}>{savingQuestionId === question.id ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}<span className="sr-only">Save answer</span></Button></div></div>)}</CardContent></Card>}

          <Card><CardHeader><h2 className="font-bold">Activity</h2></CardHeader><CardContent>{events.length === 0 ? <p className="text-sm text-slate-500">Waiting for activity…</p> : <ol className="relative ml-2 border-l border-slate-200">{events.map((event) => <li key={event.id} className="mb-7 ml-6 last:mb-0"><span className="absolute -left-2 mt-0.5 grid size-4 place-items-center rounded-full bg-indigo-100 ring-4 ring-white"><span className="size-1.5 rounded-full bg-indigo-600" /></span><div className="text-sm font-semibold text-slate-800">{event.message}</div><div className="mt-1 flex items-center gap-1 text-xs text-slate-400"><Clock3 className="size-3" />{new Date(event.created_at).toLocaleString()} · {event.event_type.replaceAll("_", " ")}</div></li>)}</ol>}</CardContent></Card>
        </div>

        <aside className="space-y-6">
          <Card><CardHeader><h2 className="font-bold">Browser session</h2></CardHeader><CardContent className="space-y-4 text-sm"><div><div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Session ID</div><div className="mt-1 break-all font-mono text-xs text-slate-700">{application.browserbase_session_id || "Waiting for worker…"}</div></div>{application.browserbase_session_url ? <Button variant="outline" className="w-full" asChild><a href={application.browserbase_session_url} target="_blank" rel="noreferrer"><MonitorPlay className="size-4" />Open live view</a></Button> : <div className="rounded-lg bg-slate-50 p-3 text-slate-500">Live View appears after Browserbase creates a session.</div>}</CardContent></Card>
          <Card className="bg-slate-950 text-white"><CardContent className="p-5"><Bot className="mb-4 size-6 text-indigo-300" /><h3 className="font-semibold">Submission guard is on</h3><p className="mt-2 text-sm leading-6 text-slate-300">The worker may navigate and fill safe fields, but it will not click a final submit button.</p></CardContent></Card>
        </aside>
      </div>
    </div>
  );
}
