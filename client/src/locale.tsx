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
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
    try {
      localStorage.setItem("alc-locale", locale);
    } catch {
      /* ignore */
    }
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
