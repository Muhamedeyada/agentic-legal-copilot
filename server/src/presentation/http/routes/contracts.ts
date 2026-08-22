import { Router } from "express";
import type { ContractCatalogPort } from "../../../domain/ports/contract-catalog.port.js";

export function contractsRouter(catalog: ContractCatalogPort): Router {
  const router = Router();

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
    const language = req.body?.language === "ar" ? "ar" : "en";
    const title = String(req.body?.title ?? req.body?.filename ?? "Uploaded contract");
    const record = await catalog.saveUpload({ title, language, text });
    res.status(201).json(record);
  });

  return router;
}
