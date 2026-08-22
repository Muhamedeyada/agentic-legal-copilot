import type { ClauseCategory } from "../entities/clause-category.js";
import type { PlaybookClause } from "../entities/playbook.js";

export interface PlaybookPort {
  list(): Promise<readonly PlaybookClause[]>;
  byCategory(
    category: ClauseCategory,
    language?: "ar" | "en",
  ): Promise<readonly PlaybookClause[]>;
}
