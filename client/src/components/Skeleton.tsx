export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

export function ClauseSkeleton() {
  return (
    <ul className="space-y-3" aria-busy="true">
      {[0, 1, 2, 3].map((i) => (
        <li key={i} className="rounded-lg border border-slate-200 p-3">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="mt-2 h-4 w-2/3" />
          <Skeleton className="mt-3 h-16 w-full" />
        </li>
      ))}
    </ul>
  );
}

export function FindingSkeleton() {
  return (
    <ul className="mt-4 space-y-2" aria-busy="true">
      {[0, 1, 2].map((i) => (
        <li key={i} className="rounded-lg border border-slate-200 p-3">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="mt-2 h-10 w-full" />
        </li>
      ))}
    </ul>
  );
}
