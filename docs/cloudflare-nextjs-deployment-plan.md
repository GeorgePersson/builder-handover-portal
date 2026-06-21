# Cloudflare-first Next.js deployment plan

Date: 2026-06-21
Branch/task context: `codex/llamacloud-greenfield` Cloudflare-first deployment planning.

## Decision

Use Cloudflare Workers with the OpenNext Cloudflare adapter as the primary deployment target for the Builder Handover Portal. Do not use Vercel unless a verified Cloudflare/OpenNext blocker prevents a production path for the current Next.js 16 app.

The existing separate Cloudflare pipeline Worker in `cloudflare/handover-pipeline/` remains a companion service. This plan is about hosting the product Next.js app itself on Cloudflare Workers/Workers Builds via `@opennextjs/cloudflare`.

## Current repo facts

- The product app is a Next.js App Router app on `next@16.2.9`, React 19, TypeScript, Tailwind, and server actions.
- `next.config.ts` only sets the server action body-size limit to `60mb`; it does not yet configure a deployment adapter.
- The app already has `src/proxy.ts`, which is the Next.js 16 replacement for middleware.
- Two PDF routes explicitly opt into the Node.js route runtime: `src/app/api/specifications/process-pdf/route.ts` and `src/app/api/specifications/extract-pdf/route.ts`.
- Local scaffold mode writes `.local-data/` and `.local-uploads/` through Node `fs`; production Supabase mode avoids those local persistence paths for core data and document storage.
- The existing Cloudflare pipeline Worker already has its own Wrangler config, D1 schema, smoke scripts, and deploy script under `cloudflare/handover-pipeline/`. Keep that config separate from the product app Worker config.

## Compatibility readout

Official Cloudflare Workers docs currently state that the OpenNext adapter supports most Next.js features used by this app: App Router, Route Handlers, React Server Components, SSR, Server Actions, response streaming, `next/after`, middleware/proxy, ISR/SSG, image optimization through Cloudflare Images, PPR, and composable caching. Cloudflare also notes that Node.js in Middleware is not yet supported.

OpenNext Cloudflare docs say existing apps can be migrated with `npx @opennextjs/cloudflare migrate` or configured manually. Manual setup requires `@opennextjs/cloudflare`, Wrangler, a root app `wrangler.jsonc`, `open-next.config.ts`, `.open-next` in `.gitignore`, and removal of `export const runtime = "edge"` where present. Wrangler must be version `3.99.0` or later, and the Worker needs `nodejs_compat` plus a compatibility date new enough for Node.js compatibility.

Next.js 16.2 also introduced a stable Adapter API. That is positive for this app because it is already on `next@16.2.9`; however, the exact adapter version still needs to be tested against this repo before calling Cloudflare production-ready.

### Current app fit

Likely compatible, with targeted review needed before deployment:

- App Router pages and route handlers are in the supported feature list.
- Server actions are in the supported feature list and are heavily used by the builder/admin/client workflows.
- `src/proxy.ts` should be compatible as long as it does not rely on unsupported Node.js-in-proxy behavior. It currently delegates Supabase session middleware and should be reviewed in a Workers preview build.
- `export const runtime = "nodejs"` is acceptable for OpenNext Cloudflare's Workers Node.js compatibility path. No `runtime = "edge"` exports were found in `src/` during this planning pass.
- The most likely blockers are Node/workerd package behavior around `pdf-parse`, `tesseract.js`, WASM worker paths, local `fs` fallback code, large PDF uploads, and any route that assumes a writable local filesystem.

## Package and config changes likely needed

Do these in a follow-up implementation branch after this plan is accepted:

1. Install deployment packages:
   - `@opennextjs/cloudflare@latest`
   - `wrangler@latest` as a dev dependency, pinned in `package-lock.json`
2. Add root product-app scripts to `package.json` without disturbing the existing pipeline Worker scripts:
   - `"preview": "opennextjs-cloudflare build && opennextjs-cloudflare preview"`
   - `"deploy": "opennextjs-cloudflare build && opennextjs-cloudflare deploy"`
   - `"cf-typegen": "wrangler types --env-interface CloudflareEnv cloudflare-env.d.ts"`
   - Optional clearer aliases: `"cloudflare:app:preview"` and `"cloudflare:app:deploy"` that run the same OpenNext commands.
3. Add a root `open-next.config.ts`:
   - Start with `defineCloudflareConfig()` only.
   - Add cache/R2 customisation only after the basic preview build works.
4. Add a root product-app `wrangler.jsonc`:
   - `main: ".open-next/worker.js"`
   - a distinct product app Worker name, for example `builder-handover-portal-app`
   - `compatibility_flags`: include `nodejs_compat`; consider `global_fetch_strictly_public` if OpenNext migration adds/recommends it and external fetch tests pass.
   - `assets.directory: ".open-next/assets"`, `assets.binding: "ASSETS"`
   - environment-specific vars/secrets for preview and production.
5. Add `.open-next` to `.gitignore` if absent.
6. Do not reuse `cloudflare/handover-pipeline/wrangler.jsonc` for the product app. That file deploys the enrichment pipeline Worker, not the Next.js app.
7. Consider running `npx @opennextjs/cloudflare migrate` in a throwaway/check branch to compare its generated config against the manual plan before committing final config.

## Required environment variables

### Public browser-safe variables

These can be configured as build/runtime variables in Cloudflare because they are meant to be public:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` today, or preferably a renamed/new `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` once the app migrates from legacy Supabase anon keys.
- `NEXT_PUBLIC_APP_URL` set to the final Cloudflare app URL/custom domain.
- `NEXT_PUBLIC_STRIPE_PROJECT_CREDIT_PRICE_ID` if checkout remains enabled from the browser/UI.

### Server-only secrets

Store these as Cloudflare Worker secrets, not committed vars and never `NEXT_PUBLIC_`:

- `SUPABASE_SERVICE_ROLE_KEY` today, or preferably `SUPABASE_SECRET_KEY`/equivalent app rename when moving to Supabase's newer secret keys.
- `OPENAI_API_KEY`
- `LLAMA_CLOUD_API_KEY`
- `CLOUDFLARE_PIPELINE_SHARED_SECRET`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `RESEND_API_KEY`

### Server-only non-secret configuration

These can be Cloudflare vars, with preview/prod differences as needed:

- `OPENAI_EXTRACTION_MODEL`
- `OPENAI_SOURCE_ENRICHMENT_MODEL`
- `OPENAI_EXTRACTION_INPUT_COST_PER_1M`
- `OPENAI_EXTRACTION_OUTPUT_COST_PER_1M`
- `OPENAI_ENRICHMENT_INPUT_COST_PER_1M`
- `OPENAI_ENRICHMENT_OUTPUT_COST_PER_1M`
- `OPENAI_WEB_SEARCH_COST_PER_1K`
- `ENABLE_DEBUG_COST_TESTS=false` in all deployed environments.
- `DOCUMENT_CONTEXT_PROVIDER=llamacloud` for Cloudflare production if LlamaCloud is the intended parser. Avoid `local_pdf` until PDF parsing/OCR compatibility is proven in workerd.
- `LLAMA_CLOUD_API_BASE_URL`
- `LLAMA_CLOUD_PARSE_TIER`
- `LLAMA_CLOUD_POLL_ATTEMPTS`
- `LLAMA_CLOUD_POLL_INTERVAL_MS`
- `CLOUDFLARE_PIPELINE_URL`
- `RESEND_FROM_EMAIL`
- `ADMIN_EMAILS`

## Supabase key handling

Supabase's current docs distinguish publishable keys for public clients from secret keys for trusted backend components. They also say legacy `anon` and `service_role` keys are deprecated by the end of 2026, with publishable (`sb_publishable_...`) and secret (`sb_secret_...`) keys recommended for new work.

Deployment rules for this app:

- Browser/client Supabase helpers may only receive a public key (`NEXT_PUBLIC_SUPABASE_ANON_KEY` for the current code, or a future publishable-key env name after migration). RLS must remain the actual data boundary for browser traffic.
- `SUPABASE_SERVICE_ROLE_KEY` or future `SUPABASE_SECRET_KEY` must be a Cloudflare secret and must only be imported by server/admin paths that perform their own authorization checks first.
- Never prefix the service/secret key with `NEXT_PUBLIC_`, never put it in `wrangler.jsonc` plain vars, and never pass it through URLs or logs.
- Keep storage uploads/downloads through Supabase Storage signed URL paths unless/until a deliberate R2 storage migration is designed.
- Before production, run a Supabase security review/advisor pass for RLS policies because Cloudflare does not change the app's Supabase data exposure model.

## Routes and code paths needing compatibility review

### Highest priority blockers

- `src/app/api/specifications/process-pdf/route.ts`: multipart PDF upload, `Buffer`, document context selection, Supabase/local storage, extraction persistence, and potentially long-running work.
- `src/app/api/specifications/extract-pdf/route.ts`: PDF preview path with `Buffer` and local PDF parsing.
- `src/lib/server/pdf-extract.ts`: uses `pdf-parse`, `tesseract.js`, WASM/core/worker paths, `node:path`, `node:url`, and a `.local-data/tesseract-cache` path. This is the biggest workerd compatibility risk.
- `src/lib/server/upload-utils.ts`: local `fs` fallback should not be used in Cloudflare production. Confirm all production deployments set Supabase env vars so files go to Supabase Storage.
- `src/lib/server/local-store/*`: local JSON persistence is a development fallback only and is not durable on Workers.

### Auth/session/proxy

- `src/proxy.ts` and `src/lib/supabase/middleware.ts`: verify cookie reads/writes and redirects under OpenNext preview. Cloudflare docs list middleware support, but Node.js in Middleware is not supported; avoid adding Node-only imports to proxy code.
- `src/lib/supabase/server.ts`, `src/lib/supabase/client.ts`, and `src/lib/supabase/admin.ts`: verify environment variable availability in OpenNext build and runtime.

### Server actions

- `src/lib/server/actions.ts` and `src/lib/server/auth-actions.ts`: large server-action surface. Confirm form posts, redirects, cookies, file uploads, and Supabase admin checks in Workers preview.
- Pay special attention to upload actions and retry actions that may download blobs and create `Buffer` instances.

### Billing/webhooks

- `src/app/api/billing/checkout/route.ts`: outbound Stripe call and base URL logic.
- `src/app/api/billing/webhook/route.ts`: HMAC verification uses `node:crypto` and `Buffer`; should be covered by `nodejs_compat`, but verify with real Stripe webhook fixture in preview.

### Debug routes

- `src/app/api/debug/*`: all must remain unavailable in production (`ENABLE_DEBUG_COST_TESTS=false` and existing `NODE_ENV === "production"` guards). They use local fixtures/files and should not be relied on in Cloudflare production.

## Deployment commands

Initial setup after packages/config are committed:

```bash
npm install @opennextjs/cloudflare@latest
npm install --save-dev wrangler@latest
npx wrangler login
npm run lint
npm run build
npm run preview
npm run deploy
```

Suggested Cloudflare app scripts once added:

```bash
npm run preview
npm run deploy
npm run cf-typegen
```

Existing companion pipeline Worker commands remain separate:

```bash
npm.cmd run cloudflare:dev
npm.cmd run cloudflare:deploy
npm.cmd run cloudflare:smoke:d1-dry-run
npm.cmd run cloudflare:smoke:live-guard
npm.cmd run cloudflare:smoke:retry
```

For CI/Workers Builds, configure the deploy command as `npm run deploy` after the product app scripts exist. Ensure Cloudflare build variables/secrets include both `NEXT_PUBLIC_...` values and server-only values needed during Next build and runtime.

## Validation sequence before production

1. Add OpenNext/Wrangler packages and config in a small PR.
2. Run `npm run lint` and `npm run build` locally.
3. Run `npm run preview` and smoke the route groups:
   - `/`
   - `/login`
   - `/builder`
   - `/builder/projects`
   - `/builder/specifications/new`
   - `/builder/specifications/review`
   - `/builder/handover-package`
   - `/admin`
   - `/admin/review`
   - `/client/portal`
4. In preview with Supabase configured, test auth cookies, project creation, document upload, spec upload, processing with `DOCUMENT_CONTEXT_PROVIDER=llamacloud`, review actions, publish, client portal open tracking, billing checkout creation, and Stripe webhook verification.
5. Run existing pipeline smokes to ensure product app config did not break the separate Worker.
6. Deploy to a preview/staging Worker domain first. Do not cut over custom domain until upload/auth/server-action tests pass on the Cloudflare-hosted app.

## Risks and blockers

- **PDF/OCR runtime risk:** `pdf-parse` and `tesseract.js` may not work reliably in workerd, especially with WASM worker paths and filesystem cache assumptions. Preferred mitigation is `DOCUMENT_CONTEXT_PROVIDER=llamacloud` in Cloudflare production and treating local PDF/OCR as local-dev fallback only until proven.
- **Filesystem durability risk:** Workers do not provide durable local disk. Any production path that falls back to `.local-data` or `.local-uploads` is a blocker. Supabase must be configured for production.
- **Large upload/request risk:** Server action and route upload limits need real Cloudflare preview testing with expected PDF sizes. The Next config allows `60mb`, but platform request limits and execution time still apply.
- **Long-running extraction risk:** Request/response extraction should stay bounded. Longer processing belongs in LlamaCloud and the existing Cloudflare pipeline Worker, not a single product app request.
- **Node compatibility risk:** `node:crypto`, `Buffer`, `path`, URL helpers, and some fs imports need OpenNext preview coverage. `nodejs_compat` is required.
- **Proxy/auth risk:** Next.js 16 proxy replaces middleware and Cloudflare docs warn Node.js in Middleware is not supported. Keep proxy code web-runtime friendly and test Supabase session refresh thoroughly.
- **Secret exposure risk:** Supabase secret/service keys, OpenAI, LlamaCloud, Stripe, Resend, and pipeline shared secrets must be Cloudflare secrets only.
- **Next/OpenNext version risk:** Next.js 16.2's stable Adapter API is encouraging, but a real `opennextjs-cloudflare build` must be run on this repo before declaring compatibility.

## Recommendation

Proceed Cloudflare-first. The app architecture is mostly aligned with OpenNext Cloudflare, and no confirmed Vercel-only blocker was found in this planning pass. The first implementation PR should add only OpenNext/Wrangler config and scripts, set production to LlamaCloud document context, keep local PDF/OCR as non-production fallback, and run a Workers preview compatibility smoke before any domain cutover.
