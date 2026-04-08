"use client";

export default function NotFound() {
  return (
    <div className="flex w-full flex-col gap-3 px-6 py-20 text-center md:px-8 lg:px-10">
      <div className="text-xs font-semibold uppercase tracking-wider text-sky-400">
        Not found
      </div>
      <h1 className="text-2xl font-semibold text-slate-100">
        This page doesn’t exist
      </h1>
      <p className="text-sm text-slate-400">
        If you reached this from an internal link, a hard refresh usually fixes
        stale dev chunks.
      </p>
      <a
        href="/"
        className="mx-auto mt-2 inline-flex items-center justify-center rounded-lg border border-surface-muted bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-white/10"
      >
        Go back home
      </a>
    </div>
  );
}

