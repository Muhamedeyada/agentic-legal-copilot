import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { UiLocale } from "./copy";

interface LocaleContextValue {
  locale: UiLocale;
  setLocale: (locale: UiLocale) => void;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

function initialLocale(): UiLocale {
  try {
    const stored = localStorage.getItem("alc-locale");
    if (stored === "ar" || stored === "en") {
      return stored;
    }
  } catch {
    /* ignore */
  }
  const fromEnv = import.meta.env.VITE_DEFAULT_LOCALE;
  return fromEnv === "ar" ? "ar" : "en";
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<UiLocale>(initialLocale);

  useEffect(() => {
    const root = document.documentElement;
    root.lang = locale;
    root.dir = locale === "ar" ? "rtl" : "ltr";
    root.classList.add("locale-switching");
    const timer = window.setTimeout(() => root.classList.remove("locale-switching"), 320);
    try {
      localStorage.setItem("alc-locale", locale);
    } catch {
      /* ignore */
    }
    return () => window.clearTimeout(timer);
  }, [locale]);

  const value = useMemo(
    () => ({
      locale,
      setLocale: (next: UiLocale) => {
        setLocaleState(next);
      },
    }),
    [locale],
  );
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error("useLocale must be used within LocaleProvider");
  }
  return ctx;
}
