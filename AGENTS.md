# agents.md — mentionpilot

## Purpose
Brand intelligence for AI assistants — tracks how ChatGPT, Claude, Gemini, and Perplexity reference brands, with evidence-readiness audits, competitor perception, GEO tools, social monitoring, and an embeddable badge widget.

## Stack
- Framework: Next.js 16 (App Router, Turbopack) — `apps/web`; Hono CF Worker — `workers/api`
- Language: TypeScript
- Styling: Tailwind CSS v4
- DB: Cloudflare D1 (SQLite) + Drizzle — schema in `packages/db`
- Auth: better-auth (Google OAuth) — web proxies to API worker for session
- Testing: Playwright (e2e, `apps/web`), Vitest (`workers/api`)
- Deploy: Cloudflare Pages (web, OpenNext bundle) + Cloudflare Workers (API)
- Package manager: pnpm workspace

## Repo structure
```
apps/
  web/                 # Next.js frontend
    src/               # App source
    content/           # MDX content (Velite)
    e2e/               # Playwright tests
    velite.config.ts   # MDX content processing
    next.config.ts     # Next.js config
packages/
  db/                  # Shared D1 schema + migrations
    src/index.ts       # Schema exports + query helpers
    migrations/        # SQL migration files (referenced by wrangler.toml)
  shared/              # Types + utilities shared by web and api
  badge-widget/        # Self-contained embeddable badge (standalone Vite build)
    src/               # Widget source
    dist/              # Built output (publish artifact)
    build.ts           # Custom build script
workers/
  api/                 # Cloudflare Worker (Hono)
    src/
      index.ts         # Entry, route registration
      routes/          # Route handlers
      middleware/      # Auth + rate-limit
      __tests__/       # Vitest unit tests
    wrangler.toml      # D1 binding, cron @ 06:00 UTC daily
scripts/
  build-badge.sh       # Build + publish badge-widget
plans/                 # Implementation plans (archive old before updating)
```

## Key commands
```bash
pnpm dev            # All packages in parallel (web + wrangler dev)
pnpm dev:web        # Next.js only
pnpm dev:api        # CF Worker only (wrangler dev)
pnpm build          # Build all packages
pnpm test           # All tests
pnpm typecheck      # TS check across workspace
pnpm lint           # Lint across workspace

# Deploy API
cd workers/api && pnpm deploy   # wrangler deploy

# Badge widget
bash scripts/build-badge.sh
```

## Architecture notes
- **pnpm workspace monorepo**: `apps/*`, `packages/*`, `workers/*`.
- **D1 migrations** in `packages/db/migrations/`; `wrangler.toml` points there via `migrations_dir`.
- **Daily cron**: Worker checks AI mentions at 06:00 UTC and stores results in D1.
- **Brand intelligence utilities**: `packages/shared/src/brand-intelligence.ts` owns the deterministic evidence audit, reusable competitor prompt set, perception clustering, and community-opportunity ranking. These are product-domain primitives; they do not generate synthetic provider results.
- **AI provider config**: Public free checks use the private `FREE_AI` service binding to Fleet's managed gateway. Per-brand BYOK endpoint settings remain stored in D1. Never hardcode provider keys.
- **Badge widget**: self-contained Vite build, `dist/` is the publish artifact. Embeddable "mentioned by AI" badge for customers.
- **Velite**: used in `apps/web` for MDX content processing (blog/docs).
- `@saas-maker/ops` is consumed as a published npm package. OpenAI-compatible transport and model discovery are repo-local so installs do not depend on an unavailable package.
- Pre-push hook via Husky.

## Idea Backlog — LLM SEO extension (source: `~/Desktop/reference/saas-ideas/README.md` line 85)

### Scope: `llms.txt` advisor + LLM-SEO planner
- Generate `llms.txt` for client sites — prioritize what LLM crawlers should see
- Score how well the site is indexed across ChatGPT/Claude/Gemini/Perplexity (existing mention pipeline already does this)
- Suggest concrete fixes — canonical pages to expose, structured summaries, FAQ blocks, schema markup
- Diff scans week-over-week → recurring revenue surface

### How it complements current brand-mention monitor
- Mention monitor = OUTPUT: am I cited by LLMs?
- `llms.txt` advisor = INPUT: what does the LLM see when it crawls?
- Reuse: existing crawl infra, AI provider config, D1 schema (extend with `site_audits`, `llms_txt_versions`)
- Same buyer, additive ARPU

### Build order
1. `llms.txt` generator from site crawl (sitemap + content classification)
2. Audit report: missing canonical summaries, weak FAQ coverage, broken structured data
3. Recurring scan + diff dashboard
4. Bundle with existing badge widget — "AI-Optimized" trust signal
