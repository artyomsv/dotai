#!/usr/bin/env node
// Registers a code review on a GitHub pull request and follows it up.
// Runs as whichever account `gh` is logged in as: a person or a machine account.
//
//   pr-review.mjs post    --findings <file.json> [--repo o/r] [--pr n] [--force] [--dry-run]
//   pr-review.mjs status  [--repo o/r] [--pr n] [--all]
//   pr-review.mjs resolve --verifications <file.json> [--sha <sha>] [--repo o/r] [--pr n] [--dry-run]
//   pr-review.mjs verdict --decision approve|request-changes [--body-file <file.md>] [--force] [--repo o/r] [--pr n] [--dry-run]
//
// Every comment the agents write carries a hidden marker, so any agent account can find and
// resolve the threads another agent account opened, and never touches threads people wrote.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const MARK = 'dotai-review';
export const SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
export const BLOCKING = new Set(['CRITICAL', 'HIGH', 'MEDIUM']);
export const LABELS = {
  approve: { name: 'review: approved', color: '0e8a16', description: 'Agent review verdict: approved' },
  'request-changes': { name: 'review: changes-requested', color: 'd93f0b', description: 'Agent review verdict: changes requested' },
};

// ---------- pure helpers (unit-tested) ----------

/** Right-side line numbers a review comment may anchor to, from a unified-diff patch. */
export function commentableLines(patch) {
  const lines = new Set();
  if (!patch) return lines;
  let right = 0;
  let inHunk = false;
  for (const line of patch.split('\n')) {
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
    if (hunk) { right = Number(hunk[1]); inHunk = true; continue; }
    if (!inHunk || line === '' || line.startsWith('-') || line.startsWith('\\')) continue;
    lines.add(right);
    right++;
  }
  return lines;
}

/**
 * Where a finding's thread goes. Every finding gets a thread so it can be verified and resolved:
 * its own line; else the nearest changed line of its file; else (file outside the diff, or no line)
 * the first changed line of the pull request. Only a pull request with no commentable line at all
 * leaves a finding in the review body.
 */
export function anchor(finding, filesLines) {
  const lines = filesLines.get(finding.path);
  const hasLine = Number.isInteger(finding.line);
  const reported = { path: finding.path, line: hasLine ? finding.line : null };
  if (lines?.size && hasLine) {
    if (lines.has(finding.line)) return { where: 'line', path: finding.path, line: finding.line };
    let nearest = null;
    for (const n of lines) if (nearest === null || Math.abs(n - finding.line) < Math.abs(nearest - finding.line)) nearest = n;
    return { where: 'line', path: finding.path, line: nearest, movedFrom: reported };
  }
  for (const [path, candidate] of filesLines) {
    if (candidate.size) return { where: 'line', path, line: Math.min(...candidate), movedFrom: reported };
  }
  return { where: 'body' };
}

export function marker(fields) {
  return `<!-- ${MARK} ${Object.entries(fields).map(([k, v]) => `${k}=${v}`).join(' ')} -->`;
}

export function parseMarker(body) {
  const m = new RegExp(`<!-- ${MARK} ([^>]*?) -->`).exec(body ?? '');
  if (!m) return null;
  return Object.fromEntries(m[1].trim().split(/\s+/).map(p => { const i = p.indexOf('='); return [p.slice(0, i), p.slice(i + 1)]; }));
}

export function validateFindings(doc) {
  const errors = [];
  if (!doc || !Array.isArray(doc.findings)) return ['findings file must be {"summary": "...", "findings": [...]}'];
  doc.findings.forEach((f, i) => {
    for (const k of ['id', 'severity', 'path', 'title', 'body']) if (!f[k]) errors.push(`findings[${i}]: missing ${k}`);
    if (f.severity && !SEVERITIES.includes(f.severity)) errors.push(`findings[${i}]: severity must be one of ${SEVERITIES.join(', ')}`);
    if (f.id && /\s/.test(f.id)) errors.push(`findings[${i}]: id must not contain spaces`);
  });
  return errors;
}

export function findingComment(f, movedFrom) {
  const where = movedFrom ? `\`${movedFrom.path}${movedFrom.line ? `:${movedFrom.line}` : ''}\`` : '';
  const moved = movedFrom ? `_About ${where}, which is outside the diff; anchored here so the finding can be tracked._\n\n` : '';
  return `**[${f.id}] ${f.severity}** — ${f.title}\n\n${moved}${f.body}\n\n${marker({ kind: 'finding', id: f.id, severity: f.severity })}`;
}

/** GitHub refuses APPROVE and REQUEST_CHANGES on your own pull request; fall back to COMMENT. */
export function reviewEvent(decision, reviewer, author) {
  if (reviewer.toLowerCase() === author.toLowerCase()) return 'COMMENT';
  return decision === 'approve' ? 'APPROVE' : 'REQUEST_CHANGES';
}

/** Why a pull request must not be approved yet. Empty lists mean it may be approved. */
export function approvalBlockers(threads, checks) {
  return {
    openFindings: threads.filter(t => t.agent && !t.isResolved && BLOCKING.has(t.severity)),
    failingChecks: checks.filter(c => c.bucket !== 'pass' && c.bucket !== 'skipping'),
  };
}

// ---------- GitHub access through gh ----------

function gh(args, input) {
  try {
    return execFileSync('gh', args, { input, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (e) {
    const err = new Error(`gh ${args.slice(0, 3).join(' ')} failed: ${(e.stderr || e.message).trim()}`);
    err.status = /HTTP (\d{3})/.exec(e.stderr || '')?.[1];
    err.stdout = e.stdout;
    throw err;
  }
}
const ghJson = (args, input) => { const out = gh(args, input); return out.trim() ? JSON.parse(out) : null; };
const get = path => ghJson(['api', path]);
const send = (method, path, body) => ghJson(['api', '-X', method, path, '--input', '-'], JSON.stringify(body));
const graphql = (query, variables) => ghJson(['api', 'graphql', '--input', '-'], JSON.stringify({ query, variables }));

function getAll(path) {
  const all = [];
  for (let page = 1; ; page++) {
    const batch = get(`${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`);
    all.push(...batch);
    if (batch.length < 100) return all;
  }
}

function context(opts) {
  const repo = opts.repo ?? gh(['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner']).trim();
  const number = Number(opts.pr ?? gh(['pr', 'view', '--json', 'number', '-q', '.number']).trim());
  const pr = get(`repos/${repo}/pulls/${number}`);
  let reviewer;
  try { reviewer = get('user').login; } catch (e) { throw new Error(`cannot tell which account gh uses (${e.message}); a machine account needs a user token`); }
  return { repo, number, pr, head: pr.head.sha, author: pr.user.login, reviewer, self: reviewer.toLowerCase() === pr.user.login.toLowerCase() };
}

const THREADS = `query($owner:String!,$name:String!,$number:Int!,$after:String){repository(owner:$owner,name:$name){pullRequest(number:$number){
  reviewThreads(first:100,after:$after){pageInfo{hasNextPage endCursor}nodes{id isResolved isOutdated path line originalLine
  comments(first:100){nodes{author{login} body url createdAt}}}}}}}`;

function threads(ctx) {
  const [owner, name] = ctx.repo.split('/');
  const out = [];
  let after = null;
  do {
    const page = graphql(THREADS, { owner, name, number: ctx.number, after }).data.repository.pullRequest.reviewThreads;
    for (const t of page.nodes) {
      const first = t.comments.nodes[0];
      const m = parseMarker(first?.body);
      const verifications = t.comments.nodes.map(c => parseMarker(c.body)).filter(x => x?.kind === 'verification');
      out.push({
        threadId: t.id, agent: m?.kind === 'finding', id: m?.id ?? null, severity: m?.severity ?? null,
        isResolved: t.isResolved, isOutdated: t.isOutdated, path: t.path, line: t.line ?? t.originalLine,
        openedBy: first?.author?.login ?? null, url: first?.url ?? null, lastVerification: verifications.at(-1) ?? null,
      });
    }
    after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
  } while (after);
  return out;
}

function checks(ctx) {
  try {
    return ghJson(['pr', 'checks', String(ctx.number), '--repo', ctx.repo, '--json', 'name,state,bucket']) ?? [];
  } catch (e) {
    // gh exits non-zero while checks fail or are pending, but still prints the JSON.
    if (e.stdout?.trim().startsWith('[')) return JSON.parse(e.stdout);
    if (/no checks reported/i.test(e.message)) return [];
    throw e;
  }
}

function ensureLabel(ctx, label) {
  try { send('POST', `repos/${ctx.repo}/labels`, label); } catch (e) { if (e.status !== '422') throw e; }
}

// ---------- commands ----------

function post(opts) {
  const doc = JSON.parse(readFileSync(opts.findings, 'utf8'));
  const errors = validateFindings(doc);
  if (errors.length) throw new Error(errors.join('\n'));
  const ctx = context(opts);
  const run = marker({ kind: 'run', head: ctx.head, reviewer: ctx.reviewer });
  const alreadyPosted = () => getAll(`repos/${ctx.repo}/pulls/${ctx.number}/reviews`)
    .find(r => { const m = parseMarker(r.body); return m?.kind === 'run' && m.head === ctx.head && m.reviewer === ctx.reviewer; });

  const previous = alreadyPosted();
  if (previous && !opts.force) return { status: 'already-posted', review: previous.html_url, note: 'this account already reviewed this head; pass --force to post again' };

  const filesLines = new Map(getAll(`repos/${ctx.repo}/pulls/${ctx.number}/files`).map(f => [f.filename, commentableLines(f.patch)]));
  const comments = [];
  const outside = [];
  for (const f of doc.findings) {
    const a = anchor(f, filesLines);
    if (a.where === 'line') comments.push({ path: a.path, line: a.line, side: 'RIGHT', body: findingComment(f, a.movedFrom) });
    else outside.push(f);
  }
  const counts = SEVERITIES.map(s => [s, doc.findings.filter(f => f.severity === s).length]).filter(([, n]) => n).map(([s, n]) => `${n} ${s}`).join(', ');
  const outsideText = outside.length
    ? `\n\n### Findings outside the diff\n\n${outside.map(f => `- **[${f.id}] ${f.severity}** — ${f.title} (\`${f.path}${f.line ? `:${f.line}` : ''}\`)\n\n  ${f.body.replace(/\n/g, '\n  ')}`).join('\n\n')}`
    : '';
  const body = `${doc.summary ?? ''}\n\n**Findings:** ${counts || 'none'}. Reviewed head \`${ctx.head.slice(0, 10)}\` as @${ctx.reviewer}.${outsideText}\n\n${run}`.trim();
  const payload = { commit_id: ctx.head, event: 'COMMENT', body, comments };
  if (opts['dry-run']) return { status: 'dry-run', payload };

  try {
    const r = send('POST', `repos/${ctx.repo}/pulls/${ctx.number}/reviews`, payload);
    return { status: 'posted', review: r.html_url, inline: comments.length, inBody: outside.length };
  } catch (e) {
    if (e.status === '422' && comments.length) {
      // One bad anchor rejects the whole review: fall back to a body-only review so nothing is lost.
      const all = `${body.replace(run, '')}\n\n### Findings (inline anchoring was rejected: ${e.message.slice(0, 200)})\n\n${comments.map(c => `- \`${c.path}:${c.line}\` ${c.body.replace(/<!--[\s\S]*?-->/g, '').replace(/\n/g, '\n  ')}`).join('\n\n')}\n\n${run}`;
      const r = send('POST', `repos/${ctx.repo}/pulls/${ctx.number}/reviews`, { commit_id: ctx.head, event: 'COMMENT', body: all });
      return { status: 'posted-body-only', review: r.html_url, reason: e.message };
    }
    // A gateway timeout can still have created the review.
    const created = alreadyPosted();
    if (created) return { status: 'posted', review: created.html_url, note: `gh reported "${e.message.slice(0, 120)}" but the review exists` };
    throw e;
  }
}

function status(opts) {
  const ctx = context(opts);
  const all = threads(ctx);
  const list = opts.all ? all : all.filter(t => t.agent);
  const blockers = approvalBlockers(all, checks(ctx));
  const agentReviews = getAll(`repos/${ctx.repo}/pulls/${ctx.number}/reviews`)
    .map(r => ({ ...parseMarker(r.body), at: r.submitted_at, url: r.html_url }))
    .filter(m => m.kind === 'run' || m.kind === 'verdict');
  const last = kind => agentReviews.filter(m => m.kind === kind).at(-1) ?? null;
  return {
    repo: ctx.repo, pr: ctx.number, head: ctx.head, author: ctx.author, reviewer: ctx.reviewer, self: ctx.self,
    lastReview: last('run'), lastVerdict: last('verdict'),
    threads: list,
    openBlocking: blockers.openFindings.map(t => t.id),
    failingChecks: blockers.failingChecks.map(c => `${c.name}: ${c.bucket}`),
  };
}

const REPLY = 'mutation($id:ID!,$body:String!){addPullRequestReviewThreadReply(input:{pullRequestReviewThreadId:$id,body:$body}){comment{url}}}';
const RESOLVE = 'mutation($id:ID!){resolveReviewThread(input:{threadId:$id}){thread{isResolved}}}';

function resolve(opts) {
  const items = JSON.parse(readFileSync(opts.verifications, 'utf8'));
  if (!Array.isArray(items)) throw new Error('verifications file must be a JSON array of {threadId, fixed, note}');
  const ctx = context(opts);
  const sha = opts.sha ?? ctx.head;
  const byId = new Map(threads(ctx).map(t => [t.threadId, t]));
  const results = [];
  for (const v of items) {
    const t = byId.get(v.threadId);
    if (!t) { results.push({ threadId: v.threadId, result: 'unknown thread' }); continue; }
    if (!t.agent) { results.push({ threadId: v.threadId, result: 'refused: not an agent thread' }); continue; }
    const body = `${v.fixed ? '✅ Verified fixed' : '❌ Not fixed'} in \`${sha.slice(0, 10)}\` by @${ctx.reviewer}.${v.note ? ` ${v.note}` : ''}\n\n${marker({ kind: 'verification', id: t.id, fixed: Boolean(v.fixed), head: sha })}`;
    if (opts['dry-run']) { results.push({ threadId: v.threadId, id: t.id, wouldReply: body, wouldResolve: Boolean(v.fixed) && !t.isResolved }); continue; }
    graphql(REPLY, { id: t.threadId, body });
    if (v.fixed && !t.isResolved) graphql(RESOLVE, { id: t.threadId });
    results.push({ threadId: v.threadId, id: t.id, result: v.fixed ? 'resolved' : 'replied, left open' });
  }
  return { head: sha, results };
}

function verdict(opts) {
  const decision = opts.decision;
  if (!LABELS[decision]) throw new Error('--decision must be approve or request-changes');
  const ctx = context(opts);
  const all = threads(ctx);
  const ci = checks(ctx);
  const blockers = approvalBlockers(all, ci);
  if (decision === 'approve' && (blockers.openFindings.length || blockers.failingChecks.length) && !opts.force) {
    return {
      status: 'refused', reason: 'cannot approve yet',
      openFindings: blockers.openFindings.map(t => `${t.id} ${t.url}`),
      failingChecks: blockers.failingChecks.map(c => `${c.name}: ${c.bucket}`),
    };
  }
  const event = reviewEvent(decision, ctx.reviewer, ctx.author);
  const agentThreads = all.filter(t => t.agent);
  const open = agentThreads.filter(t => !t.isResolved);
  const header = decision === 'approve' ? '## ✅ APPROVED' : '## ❌ CHANGES REQUESTED';
  const selfNote = event === 'COMMENT' ? '\n\n_Posted as a comment: GitHub does not let an account approve or request changes on its own pull request. The label carries the verdict._' : '';
  const extra = opts['body-file'] ? `\n\n${readFileSync(opts['body-file'], 'utf8').trim()}` : '';
  const openText = open.length ? `\n\n**Open findings:**\n${open.map(t => `- [${t.id}] ${t.severity} — ${t.url}`).join('\n')}` : '';
  const ciText = ci.length ? `${ci.filter(c => c.bucket === 'pass').length}/${ci.length} checks passing` : 'no CI checks reported';
  const body = `${header}${selfNote}${extra}\n\n**Agent findings:** ${agentThreads.length - open.length} resolved, ${open.length} open. **CI:** ${ciText}. Head \`${ctx.head.slice(0, 10)}\`, reviewed by @${ctx.reviewer}.${openText}\n\n${marker({ kind: 'verdict', decision, head: ctx.head, reviewer: ctx.reviewer })}`;
  if (opts['dry-run']) return { status: 'dry-run', event, body, label: LABELS[decision].name };

  const r = send('POST', `repos/${ctx.repo}/pulls/${ctx.number}/reviews`, { commit_id: ctx.head, event, body });
  const other = decision === 'approve' ? 'request-changes' : 'approve';
  let labelNote = 'label set';
  try {
    ensureLabel(ctx, LABELS[decision]);
    send('POST', `repos/${ctx.repo}/issues/${ctx.number}/labels`, { labels: [LABELS[decision].name] });
    try { gh(['api', '-X', 'DELETE', `repos/${ctx.repo}/issues/${ctx.number}/labels/${encodeURIComponent(LABELS[other].name)}`]); } catch (e) { if (e.status !== '404') throw e; }
  } catch (e) { labelNote = `label not set: ${e.message}`; }
  return { status: 'posted', event, review: r.html_url, label: LABELS[decision].name, labelNote, forced: Boolean(opts.force && decision === 'approve' && (blockers.openFindings.length || blockers.failingChecks.length)) };
}

// ---------- entry point ----------

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const opts = {};
  for (let i = 0; i < rest.length; i++) {
    const key = rest[i].replace(/^--/, '');
    if (i + 1 < rest.length && !rest[i + 1].startsWith('--')) opts[key] = rest[++i];
    else opts[key] = true;
  }
  return { command, opts };
}

function main() {
  const { command, opts } = parseArgs(process.argv.slice(2));
  const commands = { post, status, resolve, verdict };
  if (!commands[command]) {
    console.error('usage: pr-review.mjs post|status|resolve|verdict [options] (see the header of this file)');
    process.exit(2);
  }
  try {
    const result = commands[command](opts);
    console.log(JSON.stringify(result, null, 2));
    if (result?.status === 'refused') process.exit(3);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
