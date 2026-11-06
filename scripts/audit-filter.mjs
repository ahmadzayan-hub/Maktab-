#!/usr/bin/env node
// Fail closed on incomplete audit evidence; no accepted-risk critical exceptions.
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const levels = ['info', 'low', 'moderate', 'high', 'critical'];
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const requireThat = (condition, message) => { if (!condition) throw new Error(message); };
const text = (value) => typeof value === 'string' && value.trim().length > 0;

// Pure boundary: accepts captured subprocess output, never executes npm itself.
export function evaluateAudit(result) {
  try {
    requireThat(object(result) && !result.error && !result.signal, 'audit process failed or was interrupted');
    requireThat(result.status === 0 || result.status === 1, 'unexpected audit process exit status');
    requireThat(text(result.stdout), 'audit output is empty');
    const report = JSON.parse(result.stdout);
    requireThat(object(report) && !Object.hasOwn(report, 'error'), 'npm returned an error report');
    requireThat(report.auditReportVersion === 2, 'unsupported audit report version');
    requireThat(object(report.vulnerabilities), 'missing or invalid vulnerabilities map');
    requireThat(object(report.metadata) && object(report.metadata.vulnerabilities), 'missing audit summary');
    const counts = report.metadata.vulnerabilities;
    for (const key of [...levels, 'total']) {
      requireThat(Number.isSafeInteger(counts[key]) && counts[key] >= 0, `invalid summary count: ${key}`);
    }
    const actual = Object.fromEntries(levels.map((level) => [level, 0]));
    const lines = [];
    let advisoryCritical = false;
    for (const [pkg, vuln] of Object.entries(report.vulnerabilities)) {
      requireThat(text(pkg) && object(vuln) && vuln.name === pkg, 'invalid package entry');
      requireThat(levels.includes(vuln.severity), `invalid package severity: ${pkg}`);
      requireThat(Array.isArray(vuln.via) && vuln.via.length > 0, `missing advisory evidence: ${pkg}`);
      actual[vuln.severity]++;
      lines.push(`${pkg}: package severity ${vuln.severity}`);
      for (const via of vuln.via) {
        if (typeof via === 'string') {
          requireThat(Object.hasOwn(report.vulnerabilities, via), `unresolved advisory dependency: ${pkg}`);
          lines.push(`  via package ${via}`);
          continue;
        }
        requireThat(object(via) && levels.includes(via.severity) && text(via.title) && text(via.url), `invalid advisory: ${pkg}`);
        const url = new URL(via.url);
        requireThat(url.protocol === 'https:', `invalid advisory URL: ${pkg}`);
        const id = url.pathname.match(/(?:^|\/)(GHSA-[a-z0-9-]+)\/?$/i)?.[1];
        lines.push(`  ${id ?? via.url} (${via.severity}): ${via.title}`);
        if (via.severity === 'critical') advisoryCritical = true;
      }
    }
    // Every transitive entry must resolve to concrete advisory evidence, not
    // just a self-reference or a cycle of package names.
    for (const pkg of Object.keys(report.vulnerabilities)) {
      const pending = [pkg];
      const seen = new Set();
      let found = false;
      while (pending.length && !found) {
        const name = pending.pop();
        if (seen.has(name)) continue;
        seen.add(name);
        for (const via of report.vulnerabilities[name].via) {
          if (typeof via === 'string') pending.push(via);
          else found = true;
        }
      }
      requireThat(found, `no concrete advisory evidence: ${pkg}`);
    }
    for (const level of levels) {
      requireThat(counts[level] === actual[level], `inconsistent summary count: ${level}`);
    }
    requireThat(counts.total === Object.keys(report.vulnerabilities).length, 'inconsistent total count');
    const critical = advisoryCritical || actual.critical > 0;
    // status 1 without a critical contradicts --audit-level=critical; never pass it.
    requireThat(result.status !== 1 || critical, 'audit failed without a reported critical');
    return { code: critical ? 1 : 0, lines: [...lines, critical
      ? 'CRITICAL vulnerabilities block this gate. No exceptions are applied.'
      : 'npm audit: valid report; no CRITICAL vulnerabilities (lower severities are informational).'] };
  } catch (error) {
    // Do not echo raw npm output: it may contain credentials or registry internals.
    return { code: 2, lines: [`Security audit could not be validated: ${error instanceof SyntaxError ? 'malformed JSON or URL' : error.message}`] };
  }
}

export function runAudit(run = spawnSync, log = console.log, logError = console.error) {
  let result;
  try {
    result = run('npm', ['audit', '--json', '--audit-level=critical'], {
      encoding: 'utf8', shell: false, timeout: 120_000, maxBuffer: 10 * 1024 * 1024,
    });
  } catch {
    result = { error: true };
  }
  const verdict = evaluateAudit(result);
  for (const line of verdict.lines) (verdict.code === 0 ? log : logError)(line);
  return verdict.code;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = runAudit();
}
