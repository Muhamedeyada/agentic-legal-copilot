import { Router, type Request, type Response } from "express";
import multer from "multer";
import type { ContractCatalogPort } from "../../../domain/ports/contract-catalog.port.js";
import type { IngestDocumentUseCase } from "../../../application/ingestion/ingest-document.js";
import { DocumentTooLargeError, UnreadableDocumentError, UnsupportedDocumentError } from "../../../domain/errors.js";

type UploadOptions = multer.Options & { defParamCharset?: string };

export function contractsRouter(
  catalog: ContractCatalogPort,
  ingest: IngestDocumentUseCase,
  limits: { maxUploadBytes: number },
): Router {
  const router = Router();
  const options: UploadOptions = {
    storage: multer.memoryStorage(),
    limits: { fileSize: limits.maxUploadBytes, files: 1, fields: 4 },
    defParamCharset: "utf8",
  };
  const upload = multer(options).single("file");

  router.get("/", async (_req, res) => {
    const items = await catalog.list();
    res.json({ items });
  });

  router.get("/:id", async (req, res) => {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: "INVALID_INPUT", message: "id is required." });
      return;
    }
    const doc = await catalog.get(id);
    if (!doc) {
      res.status(404).json({ error: "NOT_FOUND", message: "Contract not found." });
      return;
    }
    res.json(doc);
  });

  router.post("/upload", async (req, res) => {
    const text = String(req.body?.text ?? "").trim();
    if (text.length === 0) {
      res.status(400).json({ error: "INVALID_INPUT", message: "Contract text is required." });
      return;
    }
    const language = req.body?.language === "ar" || req.body?.language === "en" ? req.body.language : undefined;
    const title = String(req.body?.title ?? req.body?.filename ?? "Uploaded contract");
    try {
      const { record, redactions } = await ingest.ingestText({ title, text, ...(language ? { language } : {}) });
      res.status(201).json({ ...record, redactions });
    } catch (err) {
      sendIngestError(res, err);
    }
  });

  router.post("/upload-file", (req, res) => {
    upload(req, res, (err: unknown) => {
      if (err instanceof multer.MulterError) {
        const tooLarge = err.code === "LIMIT_FILE_SIZE";
        res.status(tooLarge ? 413 : 400).json({
          error: tooLarge ? "PAYLOAD_TOO_LARGE" : "INVALID_INPUT",
          message: tooLarge ? `File exceeds ${Math.round(limits.maxUploadBytes / 1_048_576)} MB.` : err.message,
        });
        return;
      }
      if (err) {
        res.status(400).json({ error: "INVALID_INPUT", message: "Malformed multipart upload." });
        return;
      }
      void ingestUploadedFile(req, res, ingest);
    });
  });

  return router;
}

async function ingestUploadedFile(req: Request, res: Response, ingest: IngestDocumentUseCase): Promise<void> {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: "INVALID_INPUT", message: 'Send the document as multipart field "file".' });
    return;
  }
  const doc = { fileName: file.originalname, mimeType: file.mimetype, bytes: file.buffer };
  if (!ingest.supports(doc)) {
    sendIngestError(res, new UnsupportedDocumentError(file.originalname));
    return;
  }
  const title = typeof req.body?.title === "string" && req.body.title.trim() ? req.body.title.trim() : file.originalname;
  try {
    const { record, redactions } = await ingest.ingestFile(doc, title);
    res.status(201).json({ ...record, redactions });
  } catch (err) {
    sendIngestError(res, err);
  }
}

function sendIngestError(res: Response, err: unknown): void {
  if (err instanceof UnsupportedDocumentError) {
    res.status(415).json({ error: err.code, message: err.message });
  } else if (err instanceof UnreadableDocumentError) {
    res.status(422).json({ error: err.code, message: err.message });
  } else if (err instanceof DocumentTooLargeError) {
    res.status(413).json({ error: "PAYLOAD_TOO_LARGE", message: err.message });
  } else {
    res.status(500).json({ error: "INGEST_FAILED", message: "The document could not be stored." });
  }
}
