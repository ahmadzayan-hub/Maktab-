# Next.js 14 → 16 migration plan

Closes the remaining `npm audit` **high** advisories, all of which are patched
only in the Next 16 line (`next` Server-Actions DoS, bundled `postcss` XSS, and
the `eslint-config-next` / `@next/eslint-plugin-next` / `glob` toolchain).

**Audit policy correction (2026-11-06):** `next@14.2.35` remains in the
published affected ranges for three CRITICAL advisories. The audit gate now
blocks **all** critical findings, including these IDs, and fails closed when
npm does not produce a valid report. There are no accepted-risk exceptions.
This tooling change does not patch Next.js or establish deployment exploitability.

- [GHSA-p293-qw3h-jr36](https://github.com/advisories/GHSA-p293-qw3h-jr36):
  Windows-hosted servers; first patched in 15.5.24 / 16.3.3.
- [GHSA-2xp9-vwfh-vxw4](https://github.com/advisories/GHSA-2xp9-vwfh-vxw4):
  affected AVIF optimization through sharp/libheif; first patched in
  15.5.24 / 16.3.3.
- [GHSA-2464-fhr4-w9xw](https://github.com/advisories/GHSA-2464-fhr4-w9xw):
  image optimization on glibc Linux; first patched in 15.5.28 / 16.4.1.
  The advisory also documents ensuring Next.js uses sharp >=0.35.5 as a
  workaround. Runtime applicability and compatibility require verification;
  the repository lockfile alone is not deployment evidence.

15.5.28 / 16.4.1 covers all three listed advisories, not necessarily every
current advisory. Recheck current supported releases before migration.
A green audit is not proof of safe auth behavior or deployment security.

Offline gate tests: `node --test scripts/audit-filter.test.mjs` (no npm audit,
network, credentials, or installed dependencies). The gate itself runs
`npm audit --json --audit-level=critical`; exits 0 for valid non-critical
reports, 1 for critical findings, and 2 for untrustworthy audit evidence.

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
- ✅ `next` bumped to the latest 14.2.x (14.2.35) — historical interim; now has critical advisories (see above).

> This is a historical migration outline, not authorization to change this
> legacy app. The README designates `ahmadzayan-hub/maktab` as canonical.
> Plan and validate application upgrades there, then explicitly coordinate
> this legacy deployment with its dependent client shells.

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

The earlier `next` Server-Actions DoS advisory is mitigated by rate-limiting
/ size-capping Server Action payloads at the edge (middleware or platform WAF).
The eslint/glob/postcss items are build/CI-time only, not runtime-exploitable.


These historical mitigations do not establish protection against the three
critical advisories above; deployment-specific assessment remains outstanding.
