export type Locale = "ar" | "en" | "mixed";

export interface ContractDocument {
  readonly id: string;
  readonly title: string;
  readonly language: Locale;
  readonly text: string;
}

export interface Clause {
  readonly id: string;
  readonly contractId: string;
  readonly title: string;
  readonly text: string;
  readonly language: Locale;
  readonly spanStart: number;
  readonly spanEnd: number;
}
