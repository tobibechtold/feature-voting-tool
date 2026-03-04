# AGENTS.md

This file defines strict operating rules for coding agents working in `feature-voting-tool`.

## 1. Mission

Build and maintain a public feedback + bug tracking tool with:
- React/Vite frontend (`src/`)
- Supabase backend schema/functions (`supabase/`)
- Release/changelog workflows with per-platform release state

Agents MUST optimize for correctness, safety, and verifiable outcomes over speed.

## 2. Non-Negotiable Rules

1. Agents MUST NOT claim work is complete without running required verification commands in Section 6.
2. Agents MUST add or update tests for any behavior change.
3. For bug fixes, agents MUST write a failing test first, then implement the fix.
4. Agents MUST keep changes scoped to the task; unrelated refactors are prohibited unless explicitly requested.
5. Agents MUST NOT commit secrets, `.env`, service keys, or tokens.
6. Agents MUST NOT modify production behavior silently; any behavior change must be documented in PR notes.
7. Agents MUST preserve existing published release metadata (`status`, `released_at`) unless explicitly changing release status.
8. Agents MUST use ASCII by default in edited files unless the file already requires Unicode.

## 3. Tech Stack And Key Paths

- Frontend: React 18 + TypeScript + Vite + TanStack Query + shadcn/ui
- Backend: Supabase Postgres + RLS + Edge Functions
- Tests: Vitest + Testing Library (`jsdom`)

Primary directories:
- `src/pages/` route-level UI
- `src/components/` reusable UI
- `src/hooks/` data and mutation logic
- `src/types/` app and database types
- `src/lib/` shared utilities
- `supabase/migrations/` SQL migrations (append-only)
- `supabase/functions/` edge functions (`send-notification`, `verify-comment`)
- `docs/plans/` design/implementation plans

## 4. Architecture Rules

1. Data fetching/mutations MUST live in hooks (`src/hooks/*`) and not be embedded directly in page components unless trivial.
2. UI components MUST remain presentational where possible; data orchestration belongs in hooks/pages.
3. Schema changes MUST be done through new migration files in `supabase/migrations/`; do not rewrite old migrations.
4. If adding fields/tables, agents MUST update affected TypeScript types in `src/types/database.ts` and app-level types if needed.
5. Release/changelog logic changes MUST preserve semantics for:
   - per-platform release targets
   - `all` platform behavior
   - published vs planned state

## 5. Workflow Requirements

1. Start from a feature branch (never develop directly on `main` unless explicitly instructed).
2. Make focused, minimal edits.
3. Prefer `rg` for search and discovery.
4. Use `apply_patch` for small/manual edits when practical.
5. Do not revert unrelated local changes made by the user.
6. If unexpected changes appear during work, stop and ask the user how to proceed.

## 6. Required Verification Commands

Before claiming completion, agents MUST run:

```bash
npm test
npm run build
```

When Supabase schema/functions change, agents MUST also run (with project linked):

```bash
npm run supabase:db:push
npm run supabase:functions:deploy
```

If a required command cannot be run, agents MUST state that explicitly and explain why.

## 7. Testing Standards

1. Behavior change => test change.
2. Bug fix => failing test first (TDD), then fix, then green run.
3. Tests should validate real behavior, not only implementation details.
4. New tests should be placed near relevant domain files (for example `src/hooks/*.test.ts`, `src/components/*.test.tsx`).

## 8. Security And Secrets

1. Never commit `.env` or secret values.
2. New environment variables or secrets MUST be documented in `README.md`.
3. Any auth, RLS, or notification-flow changes MUST include explicit verification notes.

## 9. Definition Of Done

Work is done only when all are true:

1. Scope requested by user is implemented.
2. Relevant tests added/updated and passing.
3. `npm test` passes.
4. `npm run build` passes.
5. Any required docs updated (`README.md`, `CONTRIBUTING.md`, or `docs/plans/*` as appropriate).
6. Final report includes files changed and verification results.

## 10. PR / Commit Expectations

Agents SHOULD produce small, focused commits with clear messages, e.g.:
- `feat: add per-target release unlink action`
- `fix: preserve release published metadata on feedback assignment`
- `test: cover release platform status preservation`

PR description MUST include:
1. What changed
2. Why it changed
3. Migration/env impact
4. Verification evidence (commands + outcome)
5. Screenshots for UI changes

## 11. Operational Notes

1. Deployment target is static hosting (for example Vercel/Netlify) with build-time `VITE_*` env vars.
2. Release metadata is operationally sensitive; accidental downgrades from `released` to `planned` are regressions.
3. Notification and captcha flows rely on Supabase edge functions and secrets; verify end-to-end when touched.

