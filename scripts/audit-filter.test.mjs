import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAudit, runAudit } from './audit-filter.mjs';

const ids = ['GHSA-p293-qw3h-jr36', 'GHSA-2xp9-vwfh-vxw4', 'GHSA-2464-fhr4-w9xw'];
const clean = () => ({ auditReportVersion: 2, vulnerabilities: {}, metadata: {
  vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 },
} });
function fixture(severity = 'critical', id = ids[0]) {
  const report = clean();
  report.vulnerabilities.next = { name: 'next', severity, via: [{
    severity, title: 'Synthetic advisory (not live audit data)', url: `https://github.com/advisories/${id}`,
  }] };
  report.metadata.vulnerabilities[severity] = 1;
  report.metadata.vulnerabilities.total = 1;
  return report;
}
const capture = (report, status = 0) => ({ status, stdout: JSON.stringify(report), signal: null });
const check = (report, code, status = 0) => assert.equal(evaluateAudit(capture(report, status)).code, code);

test('valid empty report passes', () => check(clean(), 0));
for (const severity of ['info', 'low', 'moderate', 'high']) {
  test(`valid ${severity} report is visible but not blocking`, () => {
    const verdict = evaluateAudit(capture(fixture(severity)));
    assert.equal(verdict.code, 0);
    assert.match(verdict.lines.join('\n'), new RegExp(`\\(${severity}\\)`));
  });
}
for (const id of [...ids, 'GHSA-abcd-1234-efgh']) {
  test(`critical ${id} blocks and prints ID`, () => {
    const verdict = evaluateAudit(capture(fixture('critical', id), 1));
    assert.equal(verdict.code, 1);
    assert.ok(verdict.lines.some((line) => line.includes(id)));
  });
}
test('critical blocks even if process incorrectly exits zero', () => check(fixture(), 1));
test('critical advisory cannot hide behind lower package severity', () => {
  const report = fixture('high'); report.vulnerabilities.next.via[0].severity = 'critical'; check(report, 1);
});
test('critical transitive package blocks even when direct advisory is high', () => {
  const report = fixture('high');
  report.vulnerabilities.app = { name: 'app', severity: 'critical', via: ['next'] };
  report.metadata.vulnerabilities.critical = 1; report.metadata.vulnerabilities.total = 2;
  check(report, 1, 1);
});
const invalid = {
  'npm error JSON': () => ({ error: { code: 'EAUDITNOLOCK' } }),
  'npm error attached to apparently valid report': () => ({ ...clean(), error: {} }),
  'missing vulnerabilities': () => { const r = clean(); delete r.vulnerabilities; return r; },
  'array vulnerabilities': () => ({ ...clean(), vulnerabilities: [] }),
  'null report': () => null,
  'unknown version': () => ({ ...clean(), auditReportVersion: 3 }),
  'missing summary': () => ({ ...clean(), metadata: {} }),
  'inconsistent summary': () => { const r = clean(); r.metadata.vulnerabilities.critical = 1; return r; },
  'wrong total': () => { const r = clean(); r.metadata.vulnerabilities.total = 1; return r; },
  'invalid count type': () => { const r = clean(); r.metadata.vulnerabilities.high = '0'; return r; },
  'unknown package severity': () => { const r = fixture(); r.vulnerabilities.next.severity = 'CRITICAL'; return r; },
  'unknown advisory severity': () => { const r = fixture(); delete r.vulnerabilities.next.via[0].severity; return r; },
  'null advisory': () => { const r = fixture(); r.vulnerabilities.next.via = [null]; return r; },
  'empty advisory list': () => { const r = fixture(); r.vulnerabilities.next.via = []; return r; },
  'missing advisory list': () => { const r = fixture(); delete r.vulnerabilities.next.via; return r; },
  'dangling dependency': () => { const r = fixture(); r.vulnerabilities.next.via = ['missing']; return r; },
  'bad URL': () => { const r = fixture(); r.vulnerabilities.next.via[0].url = 'not a URL'; return r; },
};
for (const [name, build] of Object.entries(invalid)) test(name, () => check(build(), 2));
for (const stdout of ['', '{', 'null', '[]']) {
  test(`invalid raw output ${JSON.stringify(stdout)}`, () => assert.equal(evaluateAudit({ status: 0, stdout }).code, 2));
}
for (const override of [{ status: 2 }, { status: null }, { error: new Error('offline') }, { signal: 'SIGTERM' }]) {
  test(`subprocess failure ${JSON.stringify(override)}`, () => assert.equal(evaluateAudit({ ...capture(clean()), ...override }).code, 2));
}
test('exit 1 cannot pass with clean or high-only report', () => { check(clean(), 2, 1); check(fixture('high'), 2, 1); });
test('runner uses bounded shell-free invocation and returns critical exit', () => {
  const output = [];
  const code = runAudit((command, args, options) => {
    assert.equal(command, 'npm'); assert.deepEqual(args, ['audit', '--json', '--audit-level=critical']);
    assert.equal(options.shell, false); assert.equal(options.timeout, 120_000);
    assert.equal(options.maxBuffer, 10 * 1024 * 1024);
    return capture(fixture(), 1);
  }, () => assert.fail('critical should use stderr'), (line) => output.push(line));
  assert.equal(code, 1); assert.ok(output.some((line) => line.includes(ids[0])));
});
test('runner catches launch exceptions without exposing raw details', () => {
  const output = [];
  const code = runAudit(() => { throw new Error('SECRET'); }, () => {}, (line) => output.push(line));
  assert.equal(code, 2); assert.ok(!output.join('').includes('SECRET'));
});

test('self-referencing and two-package advisory cycles fail closed', () => {
  const report = fixture('high'); report.vulnerabilities.next.via = ['next']; check(report, 2);
  report.vulnerabilities.next.via = ['app'];
  report.vulnerabilities.app = { name: 'app', severity: 'high', via: ['next'] };
  report.metadata.vulnerabilities.high = 2; report.metadata.vulnerabilities.total = 2;
  check(report, 2);
});
test('valid non-critical transitive chain passes with concrete evidence', () => {
  const report = fixture('high');
  report.vulnerabilities.app = { name: 'app', severity: 'high', via: ['next'] };
  report.metadata.vulnerabilities.high = 2; report.metadata.vulnerabilities.total = 2;
  check(report, 0);
});
