import "./polyfills.js";

if (typeof (globalThis as any).DOMMatrix === "undefined") {
  (globalThis as any).DOMMatrix = class DOMMatrix {
    a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
    m11 = 1; m12 = 0; m13 = 0; m14 = 0;
    m21 = 0; m22 = 1; m23 = 0; m24 = 0;
    m31 = 0; m32 = 0; m33 = 1; m34 = 0;
    m41 = 0; m42 = 0; m43 = 0; m44 = 1;
    constructor() {}
    multiply() { return this; }
    translate() { return this; }
    scale() { return this; }
    rotate() { return this; }
    inverse() { return this; }
    transformPoint(p: any) { return p; }
  };
}
if (typeof (globalThis as any).Path2D === "undefined") {
  (globalThis as any).Path2D = class Path2D {};
}
if (typeof (globalThis as any).ImageData === "undefined") {
  (globalThis as any).ImageData = class ImageData {};
}

import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { loadConfig } from "./infrastructure/config.js";
import { createLegalServices, type LegalServices } from "./infrastructure/composition.js";
import { createApp } from "./presentation/http/app.js";
import type { Express } from "express";

loadEnv({ path: resolve(process.cwd(), "../.env") });
loadEnv({ path: resolve(process.cwd(), ".env") });

const config = loadConfig();
const services: LegalServices = createLegalServices(config);
const app: Express = createApp({
  config,
  orchestrator: services.orchestrator,
  counselGate: services.counselGate,
  events: services.events,
  catalog: services.catalog,
  rag: services.rag,
  ingest: services.ingest,
});

export { app, services, config, createApp };
export default app;
