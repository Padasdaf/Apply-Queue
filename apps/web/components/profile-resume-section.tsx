"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { FileText, LoaderCircle, Trash2, Upload } from "lucide-react";
import {
  MAX_RESUME_FILE_SIZE_BYTES,
  getPrimaryResume,
  type ProfileDocument,
} from "@applyqueue/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/utils";

type ResumeSectionProps = {
  documents: ProfileDocument[];
  onChanged: () => Promise<void>;
  onError: (message: string) => void;
  onNotice: (message: string) => void;
};

type UploadResponse = {
  document: ProfileDocument;
  cleanupWarning: string | null;
};

function uploadResume(file: File, onProgress: (percentage: number) => void): Promise<UploadResponse> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", "/api/profile/resume");
    request.responseType = "json";
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onload = () => {
      const response = request.response as UploadResponse & { error?: string };
      if (request.status >= 200 && request.status < 300) resolve(response);
      else reject(new Error(response?.error ?? `Upload failed (${request.status})`));
    };
    request.onerror = () => reject(new Error("The resume upload was interrupted."));
    const body = new FormData();
    body.append("file", file);
    request.send(body);
  });
}

function formatBytes(bytes: number | null): string {
  if (bytes === null) return "Size unavailable";
  return bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function ProfileResumeSection({ documents, onChanged, onError, onNotice }: ResumeSectionProps) {
  const resume = getPrimaryResume(documents);
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [progress, setProgress] = useState(0);

  async function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.type !== "application/pdf") {
      onError("Resume must be a PDF file.");
      return;
    }
    if (file.size === 0 || file.size > MAX_RESUME_FILE_SIZE_BYTES) {
      onError("Resume must be between 1 byte and 10 MB.");
      return;
    }

    setUploading(true);
    setProgress(0);
    try {
      const result = await uploadResume(file, setProgress);
      await onChanged();
      onNotice(result.cleanupWarning ?? "Primary resume uploaded.");
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not upload resume");
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }

  async function removeResume() {
    if (!resume || !window.confirm("Delete your primary resume?")) return;
    setDeleting(true);
    try {
      await api("/api/profile/resume", { method: "DELETE", body: JSON.stringify({ id: resume.id }) });
      await onChanged();
      onNotice("Resume deleted.");
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not delete resume");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <FileText className="size-5 text-indigo-600" />
          <h2 className="font-bold">Resume</h2>
        </div>
        <p className="mt-1 text-sm text-slate-500">Your private primary resume for future application attachments.</p>
      </CardHeader>
      <CardContent>
        <input ref={inputRef} className="sr-only" type="file" accept="application/pdf,.pdf" onChange={(event) => void selectFile(event)} />
        {resume ? (
          <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-white text-red-600 shadow-sm"><FileText className="size-5" /></span>
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-900">{resume.filename}</p>
                <p className="text-xs text-slate-500">Primary resume · PDF · {formatBytes(resume.file_size_bytes)}</p>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button type="button" variant="outline" disabled={uploading || deleting} onClick={() => inputRef.current?.click()}>
                {uploading ? <LoaderCircle className="size-4 animate-spin" /> : <Upload className="size-4" />}Replace
              </Button>
              <Button type="button" variant="ghost" className="text-red-600 hover:text-red-700" disabled={uploading || deleting} onClick={() => void removeResume()}>
                {deleting ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}Delete
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-5 py-7 text-center">
            <p className="text-sm text-slate-600">Upload a resume so ApplyQueue can attach it to applications.</p>
            <Button className="mt-4" type="button" disabled={uploading} onClick={() => inputRef.current?.click()}>
              {uploading ? <LoaderCircle className="size-4 animate-spin" /> : <Upload className="size-4" />}Upload PDF
            </Button>
          </div>
        )}
        {uploading && <div className="mt-4"><div className="mb-2 flex justify-between text-xs font-medium text-slate-600"><span>Uploading securely…</span><span>{progress}%</span></div><Progress value={progress} /></div>}
        <p className="mt-3 text-xs text-slate-400">PDF only, up to 10 MB. Stored in the private application-documents bucket.</p>
      </CardContent>
    </Card>
  );
}
