import type { ContractCatalogPort, ContractRecord } from "../../domain/ports/contract-catalog.port.js";
import type { DocumentFile, DocumentTextExtractorPort } from "../../domain/ports/document-text.port.js";
import { redactPii, type RedactionHit } from "../../domain/security/pii-redact.js";
import { DocumentTooLargeError, UnreadableDocumentError } from "../../domain/errors.js";

export interface IngestResult {
  readonly record: ContractRecord;
  readonly redactions: readonly RedactionHit[];
}

export function detectContractLanguage(text: string): "ar" | "en" {
  const arabic = (text.match(/[؀-ۿ]/g) ?? []).length;
  const latin = (text.match(/[A-Za-z]/g) ?? []).length;
  return arabic > 0 && arabic / (arabic + latin) >= 0.3 ? "ar" : "en";
}

/**
 * Upload pipeline: extract text, enforce the size cap, redact personal data, store.
 * Redaction happens before storage, so raw identifiers never reach the catalog or any model.
 */
export class IngestDocumentUseCase {
  constructor(
    private readonly extractor: DocumentTextExtractorPort,
    private readonly catalog: ContractCatalogPort,
    private readonly maxChars: number,
  ) {}

  supports(file: Pick<DocumentFile, "fileName" | "mimeType">): boolean {
    return this.extractor.supports(file);
  }

  async ingestFile(file: DocumentFile, title?: string): Promise<IngestResult> {
    const text = await this.extractor.extract(file);
    if (text.trim().length === 0) {
      throw new UnreadableDocumentError(
        file.fileName,
        "no text found. Scanned PDFs need OCR, which is not supported; export the contract with a text layer.",
      );
    }
    return this.ingestText({ title: title ?? file.fileName, text });
  }

  async ingestText(input: { title: string; text: string; language?: "ar" | "en" }): Promise<IngestResult> {
    if (input.text.length > this.maxChars) {
      throw new DocumentTooLargeError(input.text.length, this.maxChars);
    }
    const { text, hits } = redactPii(input.text);
    const record = await this.catalog.saveUpload({
      title: input.title,
      language: input.language ?? detectContractLanguage(text),
      text,
    });
    return { record, redactions: hits };
  }
}
