export interface Citation {
  readonly id: string;
  readonly source: "contract" | "corpus";
  readonly locator: string;
  readonly language: "ar" | "en";
  readonly excerpt: string;
  readonly isTranslation: boolean;
}

export interface ReviewMemo {
  readonly id: string;
  readonly contractId: string;
  readonly language: "ar" | "en" | "both";
  readonly bodyAr?: string;
  readonly bodyEn?: string;
  readonly citations: readonly Citation[];
  readonly approvedByCounsel: boolean;
}
