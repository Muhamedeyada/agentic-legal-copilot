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

import type { IncomingMessage, ServerResponse } from "node:http";

export type VercelRequest = IncomingMessage & {
  query?: Record<string, string | string[]>;
  cookies?: Record<string, string>;
  body?: any;
  [key: string]: any;
};

export type VercelResponse = ServerResponse & {
  send?: (body: any) => VercelResponse;
  json?: (jsonBody: any) => VercelResponse;
  status?: (statusCode: number) => VercelResponse;
  [key: string]: any;
};

let cachedApp: any = null;

async function getApp() {
  if (!cachedApp) {
    const mod = await import("../server/src/app.js");
    cachedApp = mod.default || mod.app || mod;
  }
  return cachedApp;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const app = await getApp();
    return app(req, res);
  } catch (err: any) {
    console.error("Boot error in serverless handler:", err);
    if (typeof res.status === "function" && typeof res.json === "function") {
      return res.status(500)?.json?.({ error: "Serverless boot error", message: err?.message });
    }
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Serverless boot error", message: err?.message }));
  }
}
