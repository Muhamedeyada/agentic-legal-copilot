import { useCitationFocus } from "../citation-focus";
import type { CitationTarget } from "../lib/resolve-citation";

export function CitationBadge({
  label,
  target,
  hint,
  index,
}: {
  label: string;
  target: CitationTarget;
  hint?: string;
  index?: number;
}) {
  const { focusTarget } = useCitationFocus();
  return (
    <button
      type="button"
      className="citation-badge"
      title={hint}
      onClick={() => focusTarget(target)}
    >
      {index != null ? <span className="citation-index">{index}</span> : null}
      <span className="truncate">{label}</span>
    </button>
  );
}
