#!/usr/bin/env node
/**
 * npm audit with a documented accepted-risk list for CRITICAL advisories.
 *
 * This mirrors the gate's previous behaviour (`npm audit --audit-level=critical`):
 * it fails (exit 1) only on a CRITICAL advisory that is not explicitly accepted
 * below. HIGH/MODERATE advisories are printed for visibility but never fail the
 * build here — they are tracked separately in docs/NEXT_16_MIGRATION_PLAN.md.
 *
 * Accepted entries are risk decisions, not mutes: each needs a justification
 * and should be removed the moment a non-breaking fix ships.
 */

import { execSync } from "node:child_process";

// next@14.2.35 — three CRITICAL RCE advisories with no fix in the 14.x line:
//   GHSA-p293-qw3h-jr36 — Unauthenticated RCE on windows-hosted servers
//   GHSA-2xp9-vwfh-vxw4 — Unauthenticated RCE in Image Optimization API (AVIF)
//   GHSA-2464-fhr4-w9xw — Unauthenticated RCE in Image Optimization API (SVG)
//
//   First patched versions are next@15.5.28 or next@16.4.1 (checked against the
//   GitHub Advisory DB on 2026-11-01). Both lines require the same breaking
//   change already scoped in docs/NEXT_16_MIGRATION_PLAN.md: cookies()/headers()/
//   route params become async, cascading `await` through ~43 call sites that
//   wrap this app's Supabase auth. That plan explicitly requires verifying the
//   migration against a **live Supabase environment** before landing it — "a
//   green build does not prove auth/session cookies still flow" — which this CI
//   sandbox cannot do. So there is no non-breaking fix available today; accepting
//   this as a tracked risk until the scheduled migration lands, rather than
//   force-upgrading `next` blind inside this gate.
const ACCEPTED = new Set([
  "GHSA-p293-qw3h-jr36",
  "GHSA-2xp9-vwfh-vxw4",
  "GHSA-2464-fhr4-w9xw",
]);

let raw;
try {
  raw = execSync("npm audit --json", { encoding: "utf8" });
} catch (err) {
  raw = err.stdout; // npm audit exits non-zero when advisories exist
}
const report = JSON.parse(raw);

const offending = [];
const accepted = [];
const informational = [];
for (const [pkg, vuln] of Object.entries(report.vulnerabilities ?? {})) {
  // Advisory objects live on the source package; transitive entries reference
  // their source by name (string) and are covered by the source's verdict.
  const advisories = (vuln.via ?? [])
    .filter((v) => typeof v === "object")
    .map((v) => ({ id: v.url?.split("/").pop() ?? "unknown", title: v.title ?? "", severity: v.severity }));
  for (const adv of advisories) {
    if (adv.severity !== "critical") {
      informational.push(`${pkg}: ${adv.id} (${adv.severity}) ${adv.title}`);
      continue;
    }
    (ACCEPTED.has(adv.id) ? accepted : offending).push(
      `${pkg}: ${adv.id} (${adv.severity}) ${adv.title}`,
    );
  }
}

if (informational.length) {
  console.log(`\n${informational.length} non-critical advisories (tracked in docs/NEXT_16_MIGRATION_PLAN.md, not blocking):`);
  for (const line of informational) console.log(`  ${line}`);
}

if (accepted.length) {
  console.log("\naccepted-risk (critical, documented above in this script):");
  for (const line of accepted) console.log(`  ${line}`);
}

if (offending.length) {
  console.error("\nUnaccepted CRITICAL advisories:");
  for (const line of offending) console.error(`  ${line}`);
  process.exit(1);
}
console.log("\nnpm audit: no unaccepted CRITICAL advisories");
