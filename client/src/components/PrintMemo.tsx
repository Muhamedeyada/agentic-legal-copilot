import type { RiskFinding, WorkflowSnapshot } from "../api/types";
import type { copy, UiLocale } from "../copy";

type T = (typeof copy)[UiLocale];

export function PrintMemo({
  t,
  locale,
  snapshot,
  contractTitle,
  counselId,
  findings,
}: {
  t: T;
  locale: UiLocale;
  snapshot: WorkflowSnapshot | null;
  contractTitle: string;
  counselId: string;
  findings: readonly RiskFinding[];
}) {
  const memo = snapshot?.memo;
  if (!snapshot || !memo) {
    return null;
  }
  const body = locale === "ar" ? (memo.bodyAr ?? memo.bodyEn ?? "") : (memo.bodyEn ?? memo.bodyAr ?? "");
  const critical = findings.filter((f) => f.severity === "critical").length;
  const high = findings.filter((f) => f.severity === "high").length;
  const omitted = findings.filter((f) => f.omitted).length;

  return (
    <article id="print-report" lang={locale} dir={locale === "ar" ? "rtl" : "ltr"} aria-hidden="true">
      <header className="print-brand">
        <p className="print-kicker">D1T1</p>
        <h1>{t.printTitle}</h1>
        <p className="print-sub">
          {t.product} · {t.productAr}
        </p>
      </header>
      <table className="print-meta">
        <tbody>
          <tr>
            <th>{t.selectContract}</th>
            <td>
              {contractTitle} ({snapshot.contractId})
            </td>
          </tr>
          <tr>
            <th>{t.runId}</th>
            <td>{snapshot.runId}</td>
          </tr>
          <tr>
            <th>{t.printStatus}</th>
            <td>{snapshot.state}</td>
          </tr>
          <tr>
            <th>{t.counselId}</th>
            <td>{counselId}</td>
          </tr>
          <tr>
            <th>{t.risks}</th>
            <td>
              {t.severity.critical} {critical} · {t.severity.high} {high} · {t.omission} {omitted}
            </td>
          </tr>
          <tr>
            <th>{t.printExported}</th>
            <td>{snapshot.updatedAt}</td>
          </tr>
        </tbody>
      </table>
      <p className="print-disclaimer">{t.printDisclaimer}</p>
      <section>
        <h2>{t.memoTitle}</h2>
        <pre>{body}</pre>
      </section>
      {memo.bodyEn && memo.bodyAr && locale === "en" ? (
        <section>
          <h2>العربية</h2>
          <pre dir="rtl">{memo.bodyAr}</pre>
        </section>
      ) : null}
      {memo.bodyEn && memo.bodyAr && locale === "ar" ? (
        <section>
          <h2>English</h2>
          <pre dir="ltr">{memo.bodyEn}</pre>
        </section>
      ) : null}
      {memo.citations.length > 0 ? (
        <section>
          <h2>{t.citations}</h2>
          <ol>
            {memo.citations.map((c) => (
              <li key={c.id}>
                <strong>{c.locator || c.id}</strong> · {c.source} · {c.language}
                <div>{c.excerpt}</div>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
      <footer className="print-sign">
        <div>
          <p>{t.printSignature}</p>
          <p className="print-line" />
        </div>
        <div>
          <p>{t.printDate}</p>
          <p className="print-line" />
        </div>
      </footer>
    </article>
  );
}
