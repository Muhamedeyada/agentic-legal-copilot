export interface DocumentFile {
  readonly fileName: string;
  readonly mimeType: string;
  readonly bytes: Uint8Array;
}

export interface DocumentTextExtractorPort {
  supports(file: Pick<DocumentFile, "fileName" | "mimeType">): boolean;
  extract(file: DocumentFile): Promise<string>;
}
