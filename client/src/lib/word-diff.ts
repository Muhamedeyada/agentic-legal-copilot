export type DiffToken = {
  readonly type: "eq" | "del" | "ins";
  readonly text: string;
};

const BLOCK_RATIO = 0.28;

/** Word-level LCS diff so Counsel can see playbook additions vs contract deletions. */
export function diffWords(from: string, to: string): DiffToken[] {
  const a = tokenize(from);
  const b = tokenize(to);
  if (a.length === 0) {
    return [{ type: "ins", text: to.trim() }];
  }
  if (b.length === 0) {
    return [{ type: "del", text: from.trim() }];
  }
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i -= 1) {
    const row = dp[i];
    const next = dp[i + 1];
    if (!row || !next) {
      continue;
    }
    for (let j = m - 1; j >= 0; j -= 1) {
      const here = sameToken(a[i], b[j]) ? (next[j + 1] ?? 0) + 1 : Math.max(next[j] ?? 0, row[j + 1] ?? 0);
      row[j] = here;
    }
  }
  const out: DiffToken[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    const left = a[i] ?? "";
    const right = b[j] ?? "";
    if (sameToken(left, right)) {
      push(out, "eq", left);
      i += 1;
      j += 1;
    } else if ((dp[i + 1]?.[j] ?? 0) >= (dp[i]?.[j + 1] ?? 0)) {
      push(out, "del", left);
      i += 1;
    } else {
      push(out, "ins", right);
      j += 1;
    }
  }
  while (i < n) {
    push(out, "del", a[i] ?? "");
    i += 1;
  }
  while (j < m) {
    push(out, "ins", b[j] ?? "");
    j += 1;
  }
  if (equalRatio(out) < BLOCK_RATIO) {
    return [
      { type: "del", text: from.trim() },
      { type: "ins", text: to.trim() },
    ];
  }
  return out;
}

export function isStackedRedline(tokens: readonly DiffToken[]): boolean {
  return tokens.length === 2 && tokens[0]?.type === "del" && tokens[1]?.type === "ins";
}

function tokenize(text: string): string[] {
  return text
    .trim()
    .split(/(\s+)/u)
    .filter((part) => part.length > 0);
}

function push(out: DiffToken[], type: DiffToken["type"], text: string): void {
  const last = out[out.length - 1];
  if (last && last.type === type) {
    out[out.length - 1] = { type, text: last.text + text };
    return;
  }
  out.push({ type, text });
}

function sameToken(left: string | undefined, right: string | undefined): boolean {
  if (left === undefined || right === undefined) {
    return false;
  }
  if (/^\s+$/u.test(left) && /^\s+$/u.test(right)) {
    return true;
  }
  return normalizeWord(left) === normalizeWord(right) && normalizeWord(left).length > 0;
}

function normalizeWord(token: string): string {
  return token.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

function equalRatio(tokens: readonly DiffToken[]): number {
  let eq = 0;
  let total = 0;
  for (const tok of tokens) {
    const words = tok.text.split(/\s+/u).filter((part) => part.length > 0).length;
    total += words;
    if (tok.type === "eq") {
      eq += words;
    }
  }
  return total === 0 ? 0 : eq / total;
}
