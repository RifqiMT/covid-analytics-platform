"use client";

import dynamic from "next/dynamic";

const DashboardClient = dynamic(
  () =>
    import("@/components/DashboardClient").then((m) => ({
      default: m.DashboardClient,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="w-full px-4 py-24 text-center md:px-6 lg:px-8">
        <p className="text-sm font-medium uppercase tracking-wider text-sky-400">
          COVID analytics
        </p>
        <p className="mt-3 text-lg text-slate-300">Loading dashboard…</p>
        <p className="mt-2 text-sm text-slate-500">
          If this stays here, run{" "}
          <code className="text-slate-400">npm run dev:clean</code> once to clear
          a stale build.
        </p>
      </div>
    ),
  },
);

export default function DashboardShell() {
  return <DashboardClient />;
}

