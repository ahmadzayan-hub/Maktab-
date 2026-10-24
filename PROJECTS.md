# Projects in this repository

This repository is a **multi-project workspace**, not a single app. It hosts three
independent product lines. They share no application code — each folder is
self-contained and can be split into its own GitHub repository and deployment
without touching the others.

> Deploy note: Vercel/Netlify pointed at the repo **root** build **Lahza only**
> (the root `vite` app). The sibling folders are ignored by the root build, so
> Lahza already "works separately" today. The other projects each ship their own
> build/deploy config and are extracted as shown below.

## Product line 1 — Lahza (لحظة)

| | |
| --- | --- |
| **Path** | `/` (repository root: `src/`, `public/`, `index.html`) |
| **What** | Bilingual (EN/AR) web app for personalised coffee gifts, event coffee stations and corporate campaigns |
| **Stack** | Vite + React + TypeScript + Tailwind |
| **Deploy** | Vercel or Netlify from the repo root (`vercel.json`, `netlify.toml`) |
| **Standalone** | Yes — builds and deploys from root today |

## Product line 2 — Wisal (وصال) / رسايل القلب

A family-messaging assistant delivered across three surfaces. These are **three
surfaces of one product, not duplicates**: a web landing page, an Android app,
and a Telegram bot.

| Path | Surface | Stack | Deploy target |
| --- | --- | --- | --- |
| `wisal-web/` | Landing + download page | Static HTML/CSS/JS (own `vercel.json`, `manifest`, `sitemap`, `robots`, `llms.txt`) | Vercel/Netlify as a **separate project** with Root Directory = `wisal-web` |
| `wisal-studio/` | Interactive web app — composes messages entirely client-side (local phrase bank, 4 dialects, gendered agreement); no API key, no network calls | React + Vite | Vercel as a **separate project**, Root Directory = `wisal-studio` |
| `android-wife-assistant/` | Android app | Kotlin + Gradle | Google Play / signed APK |
| `wisal-desktop/` | Windows desktop app | Electron | GitHub Releases (`windows-latest` tag: `Wisal-Setup.exe` / `Wisal-Portable.exe`), own CI at `.github/workflows/desktop.yml` |
| `telegram-wife-assistant/` | Telegram bot | Node.js (PM2 `ecosystem.config.js`) | Any always-on host (VPS/Render/Railway) via PM2 |
| `wisal-cloud-api/` | Business-mode backend (WhatsApp Business Cloud API relay) | Node.js Vercel functions | Vercel as a **separate project**, Root Directory = `wisal-cloud-api` |
| `wisal-direct-relay/` | Wisal Direct backend — device registry + encrypted-envelope store-and-forward (Phase 3, in progress; not the E2EE protocol itself, see `docs/decisions/ADR-002-e2ee-protocol.md`) | Node.js Vercel functions | Vercel as a **separate project**, Root Directory = `wisal-direct-relay` |

`agent-os/` and `agentic-os/` are organizational layers that describe/govern the
Wisal product line as an agentic system (roles, skills, memory, tools) rather
than shipping application code themselves — see their own `README.md`/`OS.md`
for scope. Neither is deployed; both are documentation + supporting scripts for
how agents work on this workspace.

## Product line 3 — Beyond Style UAE (landing page)

| | |
| --- | --- |
| **Path** | `landing/` |
| **What** | Bilingual (Arabic-first/EN) static landing page for the personalised-jewelry brand; ordering via WhatsApp + a Google order form (no backend) |
| **Stack** | Pure static HTML/CSS/JS (no build step) |
| **Deploy** | **GitHub Pages** via `.github/workflows/deploy-landing.yml` (auto-deploys on pushes touching `landing/**`); also hostable on Vercel/Netlify/Cloudflare Pages |
| **Standalone** | Yes — static files, host anywhere |

`docs/` holds shared threat models (`THREAT_MODEL.md`, `THREAT_MODEL_WISAL.md`).

## Out of scope

`operational-plan/` (static HTML annual operational plan documents) is not part
of any product line above — unrelated content, not linked from or linking to
any of the apps here.

## No duplication

There is **no duplicated project or copied application code** in the tree. Lahza
lives only at the root (`src/`); the three Wisal surfaces are distinct
implementations (web / Android / bot) of one product; and the Beyond Style UAE
landing (`landing/`) is a separate static site for a different brand — verified:
no shared or duplicated source folders across projects.

> Two distinct static "landing" folders exist but are **not duplicates**:
> `wisal-web/` markets the Wisal messaging app (with the APK download), while
> `landing/` markets the Beyond Style UAE jewelry brand. Different products,
> different content, different deploy targets.

## Deploy each project separately (no extraction required)

- **Lahza** — import this repo into Vercel/Netlify; Root Directory `.`. Done.
- **wisal-web** — new Vercel/Netlify project from this repo, Root Directory
  `wisal-web` (it has its own `vercel.json`). Fully independent build.
- **telegram-wife-assistant** — `cd telegram-wife-assistant && npm i && pm2 start
  ecosystem.config.js` on any always-on host. Needs `GROQ_API_KEY` +
  `TELEGRAM_BOT_TOKEN` (see its `README.md`).
- **android-wife-assistant** — open in Android Studio, or `./gradlew assembleRelease`.
- **wisal-desktop** — `cd wisal-desktop && npm install && npm start` for dev; CI
  (`.github/workflows/desktop.yml`) builds and publishes installers to GitHub
  Releases.
- **wisal-cloud-api** — new Vercel project, Root Directory `wisal-cloud-api`. See its `README.md` for required env vars.
- **wisal-direct-relay** — new Vercel project, Root Directory `wisal-direct-relay`. No shared secret required (per-request device signatures); see its `README.md` for the production-storage blocker before real deployment.
- **landing (Beyond Style UAE)** — already auto-deploys to GitHub Pages via
  `deploy-landing.yml`; or host the `landing/` folder as-is on any static host.

## Split a project into its own GitHub repository (history-preserving)

To move any subfolder into a brand-new repo while keeping its git history:

```bash
# 1. Split the folder into a standalone branch (keeps only its history)
git subtree split --prefix=<folder> -b split-<folder>
#    e.g. --prefix=wisal-web  |  --prefix=telegram-wife-assistant  |  --prefix=landing

# 2. Create an empty new repo on GitHub, then push the split branch as main
git push git@github.com:<you>/<new-repo>.git split-<folder>:main

# 3. In the new repo, that folder's contents are now at the root.
```

For Lahza itself (already the root app), the inverse is simpler: create its repo
from the root and delete the sibling folders **in that copy only** — this
workspace stays intact.
