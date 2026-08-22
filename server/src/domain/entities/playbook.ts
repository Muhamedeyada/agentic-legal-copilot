import type { ClauseCategory } from "./clause-category.js";

export interface PlaybookClause {
  readonly id: string;
  readonly category: ClauseCategory;
  readonly language: "ar" | "en";
  readonly title: string;
  readonly text: string;
  readonly mandatory: boolean;
}
