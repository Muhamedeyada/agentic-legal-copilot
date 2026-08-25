import { useEffect, useState } from "react";

const PREVIEW = 220;

export function ExpandableText({
  text,
  more,
  less,
  className = "",
  expanded = false,
}: {
  text: string;
  more: string;
  less: string;
  className?: string;
  expanded?: boolean;
}) {
  const [open, setOpen] = useState(expanded);

  useEffect(() => {
    if (expanded) {
      setOpen(true);
    }
  }, [expanded]);

  const long = text.length > PREVIEW;
  const shown = !long || open ? text : `${text.slice(0, PREVIEW).trim()}…`;

  return (
    <div>
      <p className={className}>{shown}</p>
      {long ? (
        <button
          type="button"
          className="mt-1 text-[11px] font-semibold text-indigo-900 underline-offset-2 hover:underline"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? less : more}
        </button>
      ) : null}
    </div>
  );
}
