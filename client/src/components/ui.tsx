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

export const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/70";

export const pressable = `select-none transition duration-150 enabled:active:scale-[0.98] disabled:cursor-not-allowed ${focusRing}`;

export const ghostBtn = `rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-body enabled:hover:border-line-strong enabled:hover:bg-surface-sunken disabled:opacity-40 ${pressable}`;

const btnMd = "px-3.5 py-2 text-sm";
export const btnSm = "px-2 py-1.5 text-xs";

export const primaryTone = `rounded-lg bg-slate-900 font-semibold text-white enabled:hover:bg-indigo-950 disabled:opacity-40 dark:bg-slate-100 dark:text-slate-900 dark:enabled:hover:bg-white ${pressable}`;

/** -700 fills: white text on emerald-600 / rose-600 is below (or barely at) WCAG AA 4.5:1. */
export const approveTone = `rounded-lg bg-emerald-700 font-semibold text-white enabled:hover:bg-emerald-800 disabled:opacity-40 ${pressable}`;

export const rejectTone = `rounded-lg bg-rose-700 font-semibold text-white enabled:hover:bg-rose-800 disabled:opacity-40 ${pressable}`;

export const primaryBtn = `${primaryTone} ${btnMd}`;
export const approveBtn = `${approveTone} ${btnMd}`;
export const rejectBtn = `${rejectTone} ${btnMd}`;

export const linkBtn = `rounded-sm text-[11px] font-semibold text-accent underline-offset-2 select-none hover:underline active:opacity-70 ${focusRing}`;

export const iconBtn = `grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line text-lg leading-none text-muted enabled:hover:border-line-strong enabled:hover:bg-surface-sunken enabled:hover:text-ink ${pressable}`;

/** Clickable cards: lift on hover. Keyboard users reach the same action through the card's own button. */
export const clickableCard =
  "cursor-pointer rounded-lg border border-line p-3 transition duration-150 hover:border-line-strong hover:bg-surface-muted hover:shadow-sm active:scale-[0.995] dark:hover:shadow-black/30";

/** Lets Counsel select text inside a clickable card without the click opening the inspector. */
export function isTextSelection(): boolean {
  return (window.getSelection()?.toString().length ?? 0) > 0;
}

export const severityBadge: Record<RiskSeverity, string> = {
  critical: "border border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400",
  high: "border border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  medium: "border border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300",
  low: "border border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

export const severityRail: Record<RiskSeverity, string> = {
  critical: "border-s-red-500 dark:border-s-red-500",
  high: "border-s-amber-500 dark:border-s-amber-500",
  medium: "border-s-blue-500 dark:border-s-blue-400",
  low: "border-s-slate-300 dark:border-s-slate-600",
};

export const severityRank: Record<RiskSeverity, number> = { critical: 3, high: 2, medium: 1, low: 0 };

export const approvedBadge =
  "border border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300";

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
