import Link from "next/link";
import { Layers3 } from "lucide-react";

export function Header() {
  return (
    <header className="border-b border-slate-200/80 bg-white/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link href="/" className="flex items-center gap-2.5 font-bold tracking-tight text-slate-950">
          <span className="grid size-9 place-items-center rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-200">
            <Layers3 className="size-5" />
          </span>
          ApplyQueue
        </Link>
        <nav className="flex items-center gap-1 text-sm font-medium">
          <Link className="rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-100 hover:text-slate-950" href="/">Queue</Link>
          <Link className="rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-100 hover:text-slate-950" href="/profile">Profile</Link>
        </nav>
      </div>
    </header>
  );
}
