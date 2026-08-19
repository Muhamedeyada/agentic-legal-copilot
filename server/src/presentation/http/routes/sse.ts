import { Router } from "express";

/** SSE heartbeat. Agent progress events will use the same endpoint. */
export function sseRouter(): Router {
  const router = Router();

  router.get("/", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    res.write(`event: hello\ndata: ${JSON.stringify({ variant: "D1T1", message: "sse-ready" })}\n\n`);

    const heartbeat = setInterval(() => {
      res.write(`event: ping\ndata: ${Date.now()}\n\n`);
    }, 15000);

    req.on("close", () => {
      clearInterval(heartbeat);
      res.end();
    });
  });

  return router;
}
