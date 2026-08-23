import type { HTMLAttributes, ReactNode } from "react";

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
      className={`rounded-xl border border-slate-200 bg-white shadow-sm ${padded ? "p-4" : ""} ${className}`}
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
      <h2 className="text-[13px] font-semibold tracking-tight text-slate-900">{children}</h2>
      {hint ? <p className="max-w-[16rem] truncate text-[11px] text-slate-500">{hint}</p> : null}
    </div>
  );
}

export const fieldClass =
  "mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition duration-150 focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10";

export const ghostBtn =
  "rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition duration-150 hover:border-slate-300 hover:bg-slate-50 disabled:opacity-40";
