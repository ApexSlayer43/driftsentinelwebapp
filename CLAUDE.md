CLAUDE.md — Drift Sentinel Webapp

WHAT THIS IS
This is the Next.js webapp for Drift Sentinel. It is the trader-facing dashboard deployed on Vercel.

REPO SEPARATION — CRITICAL
This repo (driftsentinelwebapp) is the WEBAPP repo.
It contains ONLY:
  - src/app/         → Next.js pages and API routes
  - src/components/  → React components
  - src/lib/         → Shared utilities (supabase client, types, canonicalizer)
  - public/          → Static assets (favicon, OG image, brand SVG)
  - Configuration    → next.config.ts, tailwind, postcss, components.json

It does NOT contain and MUST NEVER contain:
  ❌ extension/       (Chrome Extension — belongs in drift-sentinelv.1)
  ❌ src/engine/      (scoring engine — belongs in drift-sentinelv.1)
  ❌ src/routes/      (Express routes — belongs in drift-sentinelv.1)
  ❌ src/compute/     (ingest compute — belongs in drift-sentinelv.1)
  ❌ src/middleware/   (Express middleware — belongs in drift-sentinelv.1)
  ❌ src/ingest/      (CSV parsers — belongs in drift-sentinelv.1)
  ❌ supabase/        (DB migrations — belongs in drift-sentinelv.1)
  ❌ scripts/         (CI scripts — belongs in drift-sentinelv.1)

The webapp repo is: github.com/ApexSlayer43/driftsentinelwebapp (branch: master)
The backend repo is: github.com/ApexSlayer43/drift-sentinelv.1 (branch: main1)

Before EVERY git push, verify:
  1. pwd shows the correct repo directory
  2. git remote -v shows the correct GitHub URL
  3. git branch shows the correct branch name (master for webapp, main1 for backend)

THE STACK
  - Runtime: Next.js 16+ (App Router)
  - UI: React 19, Tailwind CSS, Lucide icons
  - Auth: Supabase Auth (SSR)
  - Database: Supabase (reads only — backend handles writes via API)
  - Deployment: Vercel (auto-deploy from master)
  - PDF parsing: pdf-parse (server-side, for protocol upload)

KEY PAGES
  /                   → Dashboard (BSS orb, drivers, violation feed)
  /protocol           → Protocol upload + rule management
  /violations         → Violation history
  /history            → Trading history
  /ingest             → CSV upload for fills
  /settings           → Trading rules, session windows, extension connection
  /login, /signup     → Auth pages

API ROUTES (webapp-side proxies)
  /api/state          → Proxies to backend /v1/state
  /api/protocol       → Proxies to backend /v1/protocol
  /api/protocol/parse → Server-side PDF text extraction (pdf-parse)
  /api/ingest/csv     → Proxies CSV upload to backend
  /api/device/provision → Extension device provisioning
  /api/chat           → Sentinel chat AI

CODING CONVENTIONS
  - TypeScript strict mode
  - All pages are client components ('use client') unless they need server-side data
  - Supabase client via @/lib/supabase/client (browser) or @/lib/supabase/server (SSR)
  - Color scheme: void (#080A0E), stable (#00D4AA), breakdown (red), text-primary/secondary/muted/dim
  - Font: JetBrains Mono (body), Syne (display)
  - Design: glass morphism cards, minimal, dark theme only
