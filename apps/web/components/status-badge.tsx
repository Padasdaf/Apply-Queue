import type { ApplicationStatus } from "@applyqueue/shared";
import { cn } from "@/lib/utils";

const styles: Record<ApplicationStatus, string> = {
  QUEUED: "bg-slate-100 text-slate-700",
  PROCESSING: "bg-blue-50 text-blue-700 ring-blue-600/10",
  NEEDS_INPUT: "bg-amber-50 text-amber-800 ring-amber-600/15",
  READY_FOR_REVIEW: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  COMPLETED: "bg-violet-50 text-violet-700 ring-violet-600/15",
  FAILED: "bg-red-50 text-red-700 ring-red-600/10",
};

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide ring-1 ring-inset", styles[status])}>
      {status.replaceAll("_", " ")}
    </span>
  );
}
