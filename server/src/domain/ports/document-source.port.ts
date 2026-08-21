import type { LegalDocument } from "../entities/document.js";

export interface DocumentSourcePort {
  list(): Promise<readonly LegalDocument[]>;
}
