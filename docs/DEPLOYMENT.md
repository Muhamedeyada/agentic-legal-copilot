# Deployment — live demo

The React client is a static site on **Vercel**. The Express API runs as **one long-running container**
(Render, Railway or Fly) from the existing `server/Dockerfile`. Vercel proxies `/api/*` and `/health`
to it, so the browser only ever talks to the Vercel URL.

Why not run the API on Vercel too: a review run lives in process memory across several requests
(`POST /api/workflow/run` → SSE stream → approve). Vercel Functions share and recycle instances and
scale to zero, so those requests can land on different instances and the run is "not found". Running
the API on Vercel would need Redis-backed adapters for the run store, approvals and event bus.

```
browser ──► https://<project>.vercel.app
              ├─ /assets/*, /*      static client (client/dist, SPA fallback to index.html)
              └─ /api/*, /health    rewrite ──► https://<api-host>   (Express, server/Dockerfile)
```

## 1. API on Render (free tier)

1. Render dashboard → **New → Web Service** → connect this GitHub repository.
2. **Runtime:** Docker · **Dockerfile path:** `server/Dockerfile` · **Docker build context:** `.` (repository root).
3. **Health check path:** `/health`.
4. **Environment variables** (the image already sets `NODE_ENV=production`, `HOST=0.0.0.0`; Render injects `PORT`):

   | Variable | Value |
   | --- | --- |
   | `DEMO_API_TOKEN` | a random string (analyst) — required in production |
   | `COUNSEL_TOKEN` | a different random string (counsel) — required in production |
   | `RATE_LIMIT_PER_MINUTE` | `600` — behind the host's proxy every visitor shares one IP, so the per-IP limit is effectively global |
   | `CLIENT_ORIGIN` | `https://<project>.vercel.app` (only used in direct mode, harmless otherwise) |
   | `OPENAI_API_KEY` | leave empty → deterministic mock completions, no paid API |

   Generate tokens with `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`.
5. Deploy and check `https://<api-host>/health` returns `{"status":"ok",...}`.

Railway or Fly work the same way: build `server/Dockerfile` from the repository root, expose the port
from `PORT`, set the variables above.

**Free-tier caveats.** Render's free instances sleep after ~15 minutes idle; the first request then takes
about a minute. Runs, approvals and uploads are in memory, so a restart or redeploy clears them.

## 2. Point `vercel.json` at the API

Replace both occurrences of `https://YOUR-API-HOST.onrender.com` in `vercel.json` with your API origin
and commit. (Rewrite destinations are literal URLs; they cannot read environment variables.)

## 3. Client on Vercel (GitHub integration)

1. Vercel dashboard → **Add New → Project** → **Import** this GitHub repository.
2. Leave **Root Directory** as the repository root. `vercel.json` sets the rest:
   install `npm ci`, build `npm run build -w client`, output `client/dist`, framework "Other".
3. **Environment variables** (Production and Preview) — the client is built with them, so they must
   match the API:

   | Variable | Value |
   | --- | --- |
   | `VITE_API_TOKEN` | same value as the API's `DEMO_API_TOKEN` |
   | `VITE_COUNSEL_TOKEN` | same value as the API's `COUNSEL_TOKEN` |
   | `VITE_API_URL` | leave unset (same-origin via the rewrites) |

4. **Deploy.** From then on every push to `main` deploys production, and every pull request gets a
   preview URL. Preview deployments use the same API through the same rewrites.

Both tokens end up in the client bundle, so anyone who opens the demo can act as Counsel. That is
acceptable for a synthetic-data demo only; it is not access control (see `docs/SECURITY.md`).

## 4. Verify

```bash
curl -s https://<project>.vercel.app/health            # proxied to the API
curl -s -o /dev/null -w "%{http_code}\n" https://<project>.vercel.app/some/deep/link   # 200 (SPA fallback)
```

Then open the app, select `D1T1-EN-NDA-003`, **Run Review**, watch the stepper stream, and **Approve**.

## If the live stream stalls through the proxy

The progress stream (`/api/workflow/stream/:runId`) is a long-lived SSE response. If Vercel's proxy
cuts it off, have the browser call the API directly instead:

1. Vercel: set `VITE_API_URL=https://<api-host>` and redeploy.
2. API: make sure `CLIENT_ORIGIN=https://<project>.vercel.app` (CORS) and redeploy.

The client then sends every request, including the stream, straight to the API host.
