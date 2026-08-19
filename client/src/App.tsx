import { useState } from "react";
import { copy } from "./copy";
import { useLocale } from "./locale";

const apiBase = import.meta.env.VITE_API_URL ?? "";

export default function App() {
  const { locale, setLocale } = useLocale();
  const t = copy[locale];
  const [health, setHealth] = useState<"idle" | "ok" | "fail">("idle");

  async function checkHealth(): Promise<void> {
    try {
      const res = await fetch(`${apiBase}/health`);
      setHealth(res.ok ? "ok" : "fail");
    } catch {
      setHealth("fail");
    }
  }

  const healthLabel =
    health === "ok" ? t.healthOk : health === "fail" ? t.healthFail : t.healthIdle;

  return (
    <div className="mx-auto min-h-dvh max-w-5xl px-6 py-8">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-(--color-rule) pb-6">
        <div>
          <p className="text-xs font-medium tracking-wide text-(--color-accent)">{t.variant}</p>
          <h1 className="mt-2 text-3xl font-semibold">{t.product}</h1>
        </div>
        <button
          type="button"
          className="rounded border border-(--color-ink) px-3 py-1.5 text-sm"
          onClick={() => setLocale(locale === "ar" ? "en" : "ar")}
        >
          {t.toggle}
        </button>
      </header>

      <p className="mt-8 max-w-3xl text-lg leading-relaxed">{t.intro}</p>

      <section className="mt-10 grid gap-4 md:grid-cols-2">
        <AgentCard title={t.extract} hint={t.extractHint} />
        <AgentCard title={t.risk} hint={t.riskHint} />
        <AgentCard title={t.memo} hint={t.memoHint} />
        <AgentCard title={t.gate} hint={t.gateHint} />
      </section>

      <section className="mt-10 border border-(--color-rule) bg-white p-5">
        <h2 className="text-sm font-semibold">{t.health}</h2>
        <p className="mt-2 text-sm text-stone-600">{healthLabel}</p>
        <button
          type="button"
          className="mt-4 rounded bg-(--color-ink) px-4 py-2 text-sm text-(--color-paper)"
          onClick={() => void checkHealth()}
        >
          {t.checkHealth}
        </button>
      </section>
    </div>
  );
}

function AgentCard({ title, hint }: { title: string; hint: string }) {
  return (
    <article className="border border-(--color-rule) bg-white p-5">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-stone-600">{hint}</p>
    </article>
  );
}
