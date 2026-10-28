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
