# Next.js 14 → 16 migration plan

Closes the remaining `npm audit` **high** advisories, all of which are patched
only in the Next 16 line (`next` Server-Actions DoS, bundled `postcss` XSS, and
the `eslint-config-next` / `@next/eslint-plugin-next` / `glob` toolchain).

**Update (2026-11-01):** `next@14.2.35` has since picked up 3 **CRITICAL**
unauthenticated-RCE advisories (GHSA-p293-qw3h-jr36, GHSA-2xp9-vwfh-vxw4,
GHSA-2464-fhr4-w9xw). First patched versions are `next@15.5.28` or
`next@16.4.1` — i.e. the fix requires this same migration (no 14.x patch
exists). Until this migration lands, those 3 CRITICALs are accepted-risk and
documented with justification in `scripts/audit-filter.mjs`, which the CI
"Security audit (block new criticals)" step runs instead of a bare
`npm audit --audit-level=critical`. This raises the urgency of this migration:
treat it as a security fix, not just a lint/toolchain cleanup.

> **Why this is a scheduled migration, not a quick fix:** the core change
> (Next 15+ makes `cookies()` / `headers()` / route `params` **async**) touches
> the app's authentication path. It must be verified against a **live Supabase
> environment** — a green build does not prove auth/session cookies still flow
> (operating rule 11). Do this in a branch with real env vars, not blind.

## Measured blast radius (from this repo)

| Change | Scope | Files |
| --- | --- | --- |
| `cookies()` becomes async | **2 direct sites**, but they wrap the whole app's auth | `src/lib/supabase/server.ts:7`, `src/lib/db/supabase-server.ts:25` |
| …cascades `await` to callers | **~43 call sites** import the Supabase server client | `getServerSupabase()` / `createClient()` callers |
| Route `params` becomes `Promise` | **~10 dynamic routes** | `src/app/**/[id]/**` route handlers & pages |
| `eslint-config-next@16` needs eslint 9 | flat-config migration | `.eslintrc*` → `eslint.config.mjs`, eslint 8.57 → 9 |
| Peer deps | Next 16 accepts **React 18.2+** (no forced React 19) | `next`, `eslint-config-next` |

## Prep already done (this branch)

- ✅ Removed the unused, deprecated `@supabase/auth-helpers-nextjs` (a Next-16 incompatibility; 0 imports in `src`).
- ✅ `next` bumped to the latest 14.2.x (14.2.35) — safe interim.

## Step-by-step (in an env with live Supabase)

1. **Async cookie wrappers.** Make `getServerSupabase()` and `createClient()`
   `async`; `const cookieStore = await cookies()`. `await` is transparent on
   Next 14's sync `cookies()`, so this is forward-compatible and can be landed
   and verified on Next 14 first.
2. **Await the cascade.** Update all ~43 callers to `await` the client. TypeScript
   enforces this — `npm run typecheck` fails on any missed site, giving high
   confidence the cascade is complete.
3. **Async route params.** For each dynamic route, type `params` as
   `Promise<{ … }>` and `await` it (Next 15 codemod:
   `npx @next/codemod@latest next-async-request-api .`).
4. **Bump framework.** `npm i next@16` (keep React 18). Run the Next 16 upgrade
   codemod; review `next.config.mjs` for renamed/removed options.
5. **ESLint 9.** `npm i -D eslint@9 eslint-config-next@16`; migrate `.eslintrc`
   to `eslint.config.mjs` (flat config).
6. **Verify (gates that need a live env):**
   - `typecheck`, `lint`, `test`, `build` — all green.
   - **Runtime auth journeys:** sign in, session persists across navigation,
     protected routes redirect when signed out, sign-out clears the session.
   - **Stripe webhook** still verifies signatures (unit test already covers this).
   - `npm audit` → expected **0 high** once on `next@16` + `eslint-config-next@16`.

## Interim mitigation (until the migration lands)

The one runtime advisory (`next` Server-Actions DoS) is mitigated by rate-limiting
/ size-capping Server Action payloads at the edge (middleware or platform WAF).
The eslint/glob/postcss items are build/CI-time only, not runtime-exploitable.
