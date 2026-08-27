import { useEffect } from "react";
import { createPortal } from "react-dom";

export function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const id = window.setTimeout(onDone, 2200);
    return () => window.clearTimeout(id);
  }, [message, onDone]);

  return createPortal(
    <p role="status" aria-live="polite" className="inspector-toast print:hidden">
      {message}
    </p>,
    document.body,
  );
}
