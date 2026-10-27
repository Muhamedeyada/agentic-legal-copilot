import type { HTMLAttributes, ReactNode } from "react";
import type { RiskSeverity } from "../api/types";

export function Card({
  children,
  className = "",
  padded = true,
  ...rest
}: HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  padded?: boolean;
}) {
  return (
    <section
      {...rest}
      className={`rounded-xl border border-line bg-surface shadow-sm dark:shadow-none ${padded ? "p-4" : ""} ${className}`}
    >
      {children}
    </section>
  );
}

export function PaneTitle({
  children,
  hint,
}: {
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-2">
      <h2 className="text-[13px] font-semibold tracking-tight text-ink">{children}</h2>
      {hint ? <p className="max-w-[16rem] truncate text-[11px] text-muted">{hint}</p> : null}
    </div>
  );
}

export const fieldClass =
  "mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none transition duration-150 placeholder:text-muted focus:border-line-strong focus:ring-2 focus:ring-slate-900/10 dark:focus:border-slate-500 dark:focus:ring-white/10";

export const ghostBtn =
  "rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-body transition duration-150 hover:border-line-strong hover:bg-surface-muted disabled:opacity-40";

export const primaryBtn =
  "rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white transition duration-150 hover:bg-indigo-950 disabled:opacity-40 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white";

/** -700 fills: white text on emerald-600 / rose-600 is below (or barely at) WCAG AA 4.5:1. */
export const approveBtn =
  "rounded-lg bg-emerald-700 px-3.5 py-2 text-sm font-semibold text-white transition duration-150 hover:bg-emerald-800 disabled:opacity-40";

export const rejectBtn =
  "rounded-lg bg-rose-700 px-3.5 py-2 text-sm font-semibold text-white transition duration-150 hover:bg-rose-800 disabled:opacity-40";

export const linkBtn = "text-[11px] font-semibold text-accent underline-offset-2 hover:underline";

export const severityBadge: Record<RiskSeverity, string> = {
  critical: "bg-rose-700 text-white",
  high: "bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-200 dark:ring-1 dark:ring-inset dark:ring-rose-800/60",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-200 dark:ring-1 dark:ring-inset dark:ring-amber-800/60",
  low: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-200 dark:ring-1 dark:ring-inset dark:ring-emerald-800/60",
};

export const tone = {
  danger: {
    box: "border border-rose-200 bg-rose-50 dark:border-rose-900/70 dark:bg-rose-950/40",
    text: "text-rose-800 dark:text-rose-200",
  },
  warning: {
    box: "border border-amber-200 bg-amber-50 dark:border-amber-900/70 dark:bg-amber-950/40",
    text: "text-amber-800 dark:text-amber-200",
  },
  success: {
    box: "border border-emerald-200 bg-emerald-50 dark:border-emerald-900/70 dark:bg-emerald-950/40",
    text: "text-emerald-800 dark:text-emerald-200",
  },
} as const;
