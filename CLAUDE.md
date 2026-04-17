# CLAUDE.md

Operating guide for Claude Code sessions working on this repository.

## Project: AutoLabels.io

Dealer window-sticker + addendum + compliance platform. Part of the
Autocurb/AutoLabels family of apps (autolabels, autocurb, autoframe,
autovideo) that share one Supabase project, one `auth.users`, one
`tenants` row per dealer group, and per-app `app_entitlements`.

Stack: Vite + React 18 + TypeScript + Tailwind + shadcn/ui + TanStack
Query + react-router v6 + Supabase (auth + Postgres + Storage + Edge
Functions). Bun as package manager.

## Git Workflow — MANDATORY

This repo (`KenCarbiz/autolables-95db60ea`) is the **canonical repo
and the Lovable-watched repo**. All work lands here, and Lovable
reads from `main`, so changes must reach `main` for the preview to
update.

1. **Push directly to `main` on every change.** This is the
   Lovable-watched repo; there is no mirror step. Commit locally,
   then `git push origin main`.
2. **Do not open PRs** unless the user explicitly asks. Direct
   commits to `main` are the expected flow.
3. **Commit messages**: imperative mood, single sentence headline,
   blank line, bullet-point body if the change has multiple parts.
   No Claude Code attribution footer.
4. **Never force-push `main`** and never skip hooks (`--no-verify`).
   Never amend published commits.
5. **Remote**: `origin` is `KenCarbiz/autolables-95db60ea`. All
   pushes go here. There is no separate `autolables` canonical repo
   in this workflow.

## Code rules

- TypeScript strict, no `any` unless already in a pattern.
- Don't create docs files (`*.md`, README additions) unless explicitly
  requested. This file is the one exception.
- Prefer editing existing files over creating new ones.
- No emoji in files, strings, commit messages, or UI copy unless the
  user explicitly asks for one.
- Default to zero comments. Only comment when the WHY is non-obvious
  (a subtle invariant, a legal/compliance hook, a workaround).
- Match existing styling patterns (Tailwind utility classes, shadcn
  primitives, `rounded-2xl`, `shadow-premium`, `font-display`).

## Architecture cheat-sheet

- **Public routes** (no auth gate): `/`, `/login`, `/onboarding`,
  `/about`, `/brand`, `/scan`, `/v/:slug`, `/vehicle/:vin`,
  `/sign/:token`, `/deal/:token`.
- **Gated routes** (EntitlementGate app="autolabels" + AppShell):
  `/dashboard`, `/admin`, `/addendum`, `/saved`, `/buyers-guide`,
  `/trade-up`, `/used-car-sticker`, `/new-car-sticker`, `/cpo-sheet`,
  `/compliance`, `/description-writer`, `/add-inventory`, `/prep`.
- **Shared tenant primitives** live in
  `supabase/migrations/20260417030000_shared_tenant_entitlements.sql`:
  `tenants`, `tenant_members`, `onboarding_profiles`,
  `app_entitlements`, `handoff_tokens`. Use `useEntitlements()` to
  read them client-side.
- **Sticker publish loop**: UsedCarSticker / NewCarSticker call
  `useVehicleListing().createListing()` + `.publishListing()` to
  produce a public `/v/<slug>` URL that the QR resolves to.
- **Prep compliance gate**: `/prep` + `usePrepSignOff` — a vehicle
  cannot be listed until the foreman sign-off row has
  `listing_unlocked = true`.
- **NHTSA recall**: `useRecallLookup` + `<RecallBanner>` +
  `supabase/functions/nhtsa-recall` — hard-blocks publish on
  do-not-drive campaigns.
- **E-SIGN**: `src/lib/esign.ts` (consent text + SHA-256 hash + IP
  capture) used by MobileSigning. Every signed addendum stores
  `content_hash`, `esign_consent`, `user_agent`, `customer_ip`.

## Important factual notes (for marketing + compliance copy)

- **FTC CARS Rule was VACATED** by the 5th Circuit on Jan 27, 2025
  (No. 24-60013). Do **not** say "CARS Act compliant". Use
  "FTC-aligned" or "50-state disclosure engine" instead.
- **California SB 766** was signed Oct 6, 2025, effective
  **October 1, 2026**. 3-day used-car return under $50k, up-front
  cost disclosure, ban on useless add-ons. CA doc fee cap stays at
  **$85** (SB 791 raise vetoed).
- Federal Monroney Label Act applies to new cars.
- FTC Used Car Rule (16 CFR Part 455) requires the Buyers Guide on
  every used car — bilingual where the sale is conducted in Spanish.

## Run / verify commands

- Dev server: `bun run dev`
- Typecheck: `bunx tsc -p tsconfig.app.json --noEmit`
- Tests: `bun run test`
- Production build smoke: `bun run build`
- Lint: ESLint is configured but currently not installing cleanly in
  sandbox; rely on typecheck + tests.
