import { useTheme } from "../context/ThemeContext";
import { pressable } from "./ui";

export function ThemeToggle({ toDarkLabel, toLightLabel }: { toDarkLabel: string; toLightLabel: string }) {
  const { theme, toggleTheme } = useTheme();
  const dark = theme === "dark";
  const label = dark ? toLightLabel : toDarkLabel;
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className={`grid h-7 w-7 place-items-center rounded-full bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white ${pressable}`}
    >
      <svg className="theme-icon h-3.5 w-3.5" data-shown={!dark} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </svg>
      <svg className="theme-icon h-3.5 w-3.5" data-shown={dark} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z" />
      </svg>
    </button>
  );
}
