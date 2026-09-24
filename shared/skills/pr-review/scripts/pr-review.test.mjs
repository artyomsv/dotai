// node --test shared/skills/pr-review/scripts/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  commentableLines, anchor, marker, parseMarker, validateFindings, findingComment, reviewEvent, approvalBlockers,
} from './pr-review.mjs';

const PATCH = [
  '@@ -1,3 +1,4 @@',
  ' keep one',
  '-removed',
  '+added two',
  '+added three',
  ' keep four',
  '@@ -20,2 +21,2 @@',
  ' keep twenty-one',
  '+added twenty-two',
  '\\ No newline at end of file',
].join('\n');

test('commentableLines keeps right-side context and added lines, skips removed ones', () => {
  assert.deepEqual([...commentableLines(PATCH)], [1, 2, 3, 4, 21, 22]);
});

test('commentableLines of a binary or huge file (no patch) is empty', () => {
  assert.equal(commentableLines(undefined).size, 0);
});

test('anchor uses the exact line when it is in the diff', () => {
  const files = new Map([['a.js', commentableLines(PATCH)]]);
  assert.deepEqual(anchor({ path: 'a.js', line: 3 }, files), { where: 'line', path: 'a.js', line: 3 });
});

test('anchor moves a line outside the hunks to the nearest changed line of the same file and says so', () => {
  const files = new Map([['a.js', commentableLines(PATCH)]]);
  assert.deepEqual(anchor({ path: 'a.js', line: 18 }, files), { where: 'line', path: 'a.js', line: 21, movedFrom: { path: 'a.js', line: 18 } });
});

test('anchor gives a file outside the diff, or a finding with no line, a thread on the first changed line', () => {
  const files = new Map([['empty.bin', new Set()], ['a.js', commentableLines(PATCH)]]);
  assert.deepEqual(anchor({ path: 'b.js', line: 9 }, files), { where: 'line', path: 'a.js', line: 1, movedFrom: { path: 'b.js', line: 9 } });
  assert.deepEqual(anchor({ path: 'a.js' }, files), { where: 'line', path: 'a.js', line: 1, movedFrom: { path: 'a.js', line: null } });
});

test('anchor leaves a finding in the body only when the pull request has no commentable line', () => {
  assert.deepEqual(anchor({ path: 'a.js', line: 1 }, new Map([['a.bin', new Set()]])), { where: 'body' });
});

test('marker round-trips through a comment body', () => {
  const body = `text\n\n${marker({ kind: 'finding', id: 'security/H-1', severity: 'HIGH' })}`;
  assert.deepEqual(parseMarker(body), { kind: 'finding', id: 'security/H-1', severity: 'HIGH' });
  assert.equal(parseMarker('a comment a person wrote'), null);
});

test('findingComment carries id, severity and a finding marker', () => {
  const body = findingComment({ id: 'qa/M-2', severity: 'MEDIUM', title: 'T', body: 'B' }, { path: 'b.js', line: 7 });
  assert.match(body, /^\*\*\[qa\/M-2\] MEDIUM\*\* — T/);
  assert.match(body, /About `b\.js:7`, which is outside the diff/);
  assert.equal(parseMarker(body).kind, 'finding');
});

test('validateFindings rejects a missing field, an unknown severity and an id with spaces', () => {
  const errors = validateFindings({ findings: [{ id: 'a b', severity: 'BLOCKER', path: 'x', title: 't' }] });
  assert.equal(errors.length, 3);
  assert.deepEqual(validateFindings({ findings: [] }), []);
  assert.equal(validateFindings({}).length, 1);
});

test('reviewEvent falls back to COMMENT on your own pull request, case-insensitively', () => {
  assert.equal(reviewEvent('approve', 'ArtyomSV', 'artyomsv'), 'COMMENT');
  assert.equal(reviewEvent('approve', 'machine-1', 'artyomsv'), 'APPROVE');
  assert.equal(reviewEvent('request-changes', 'machine-1', 'artyomsv'), 'REQUEST_CHANGES');
});

test('approvalBlockers: open CRITICAL/HIGH/MEDIUM agent threads and non-green checks block; LOW and people threads do not', () => {
  const threads = [
    { agent: true, isResolved: false, severity: 'HIGH', id: 'h' },
    { agent: true, isResolved: true, severity: 'CRITICAL', id: 'c' },
    { agent: true, isResolved: false, severity: 'LOW', id: 'l' },
    { agent: false, isResolved: false, severity: null, id: null },
  ];
  const checks = [{ name: 'a', bucket: 'pass' }, { name: 'b', bucket: 'skipping' }, { name: 'c', bucket: 'pending' }, { name: 'd', bucket: 'fail' }];
  const b = approvalBlockers(threads, checks);
  assert.deepEqual(b.openFindings.map(t => t.id), ['h']);
  assert.deepEqual(b.failingChecks.map(c => c.name), ['c', 'd']);
  assert.deepEqual(approvalBlockers([], []), { openFindings: [], failingChecks: [] });
});
