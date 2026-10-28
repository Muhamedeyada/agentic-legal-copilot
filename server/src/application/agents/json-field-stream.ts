const ESCAPES: Record<string, string> = { '"': '"', "\\": "\\", "/": "/", b: "\b", f: "\f", n: "\n", r: "\r", t: "\t" };
const MAX_KEY_CHARS = 64;

/**
 * Incrementally pulls the decoded values of selected string fields out of a JSON document arriving
 * in arbitrary chunks, e.g. `{"memo":{"bodyEn":"# Memo\n..."}}`. Only those values are emitted, so
 * a UI can show the memo text while the model is still writing it, without ever seeing raw JSON.
 * Field matching is by key name at any depth; malformed JSON simply stops producing output.
 */
export class JsonStringFieldStream<F extends string> {
  private inString = false;
  private escape = false;
  private unicode: string | null = null;
  private pendingHighSurrogate = "";
  private key = "";
  private lastKey = "";
  private expectingValue = false;
  private target: F | null = null;
  private stringIsKey = false;

  constructor(
    private readonly fields: readonly F[],
    private readonly onValue: (field: F, text: string) => void,
  ) {}

  push(chunk: string): void {
    let out = "";
    const flush = (): void => {
      if (out.length > 0 && this.target) this.onValue(this.target, out);
      out = "";
    };

    for (const ch of chunk) {
      if (!this.inString) {
        if (ch === '"') {
          this.inString = true;
          this.stringIsKey = !this.expectingValue;
          this.target = this.expectingValue && this.isField(this.lastKey) ? (this.lastKey as F) : null;
          this.key = "";
          this.expectingValue = false;
        } else if (ch === ":") {
          this.expectingValue = true;
        } else if (ch === "," || ch === "{" || ch === "[" || ch === "}" || ch === "]") {
          this.expectingValue = false;
        }
        continue;
      }

      let decoded: string | null = null;
      if (this.unicode !== null) {
        this.unicode += ch;
        if (this.unicode.length < 4) continue;
        const code = Number.parseInt(this.unicode, 16);
        this.unicode = null;
        const char = Number.isNaN(code) ? "" : String.fromCharCode(code);
        if (code >= 0xd800 && code <= 0xdbff) {
          this.pendingHighSurrogate = char;
          continue;
        }
        decoded = this.pendingHighSurrogate + char;
        this.pendingHighSurrogate = "";
      } else if (this.escape) {
        this.escape = false;
        if (ch === "u") {
          this.unicode = "";
          continue;
        }
        decoded = ESCAPES[ch] ?? ch;
      } else if (ch === "\\") {
        this.escape = true;
        continue;
      } else if (ch === '"') {
        flush();
        this.inString = false;
        if (this.stringIsKey) this.lastKey = this.key;
        this.target = null;
        continue;
      } else {
        decoded = ch;
      }

      if (this.stringIsKey) {
        if (this.key.length < MAX_KEY_CHARS) this.key += decoded;
      } else if (this.target) {
        out += decoded;
      }
    }
    flush();
  }

  private isField(key: string): boolean {
    return (this.fields as readonly string[]).includes(key);
  }
}
