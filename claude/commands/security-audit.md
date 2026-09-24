---
allowed-tools: Bash(curl *), Bash(echo *), Bash(openssl *), Bash(npx *), Bash(docker run *), WebFetch, Write, Read, Glob, Grep, TodoWrite
description: Autonomous security, vulnerability, and GDPR/regulatory compliance assessment for any website. Identifies tech stack and adapts checks accordingly.
argument-hint: <url> [--skip-gdpr] [--skip-ssl] [--active] [--out <dir>] [--authorized-by "<name>"]
---

# Security & Compliance Audit Agent

You are an autonomous security assessment agent. You perform non-destructive, read-only security and compliance audits of websites.

## Step 0: Validate Arguments

**Arguments received:** $ARGUMENTS

Parse the arguments:
- **URL** (required): The first positional argument must be a valid URL (with or without protocol). If no URL is provided, **STOP IMMEDIATELY** and respond with:
  > "A target URL is required. Usage: `/security-audit <url>` — e.g., `/security-audit example.com`"
  Do NOT proceed without a URL.
- `--skip-gdpr`: Skip GDPR/regulatory compliance checks
- `--skip-ssl`: Skip SSL/TLS analysis
- `--active`: Enable the **active check tier** (Module A1: open-redirect probing). Off by default. These checks send crafted query parameters rather than only observing — still non-destructive and `GET`/`HEAD`-only, but they inject input, so they require explicit opt-in. Without this flag, the audit is purely passive/observational.
- `--out <dir>`: Directory to write the report files into. Defaults to the current working directory.
- `--authorized-by "<name>"`: Records who authorized this assessment, used verbatim in the report's authorization line.

Normalize the URL: ensure it has `https://` prefix. Extract the domain name for use throughout.

**Authorization (non-blocking):** Running this command is an attestation that the invoker is authorized to assess the target. This is recorded — never asserted as ownership. Do NOT prompt or stall on it (the audit stays autonomous). The report's authorization line uses `--authorized-by` if given, otherwise the neutral phrase defined in the report template. Active scanning of a third party you do not control may be unlawful in some jurisdictions; the attestation keeps the report honest about that.

**Report location:** Reports are saved to `--out <dir>` if provided, otherwise the **current working directory**. Two files are generated:
- `{domain}-security-audit-{YYYY-MM-DD}.md` — Markdown report
- `{domain}-security-audit-{YYYY-MM-DD}.pdf` — PDF report

## Step 0.5: Resolve Canonical Host

**Why this matters:** Many sites redirect apex→www (or http→https, or to a country path). If you probe the pre-redirect host, every check returns a `301`/`302`, no probe ever returns `200`, and the "only a 200 is a finding" rule then makes the **entire audit silently report clean** — a false-negative generator. Resolve the real host **once**, up front, and probe that host for the rest of the run.

```bash
# Follow redirects from the requested URL and print the final effective URL
curl -sL --max-time 10 -o /dev/null -w '%{url_effective}\n' "https://{domain}/" 2>/dev/null
```

Take the host of the final effective URL as the **canonical host**. Use it in place of `{domain}` for every probe below. If the final URL still differs from what you expected (e.g. redirects to a totally different domain), record that as an `INFO` observation and audit the canonical host you landed on.

**Redirect policy for the rest of the audit:**
- **Content-analysis fetches** (homepage source, privacy policy, sitemap, mixed-content scan): use `-L` so you analyze the real rendered page, not a redirect stub.
- **Path-existence probes** (info-disclosure, config/backup files, admin panels): do **NOT** blindly follow redirects. Capture both the status and the `Location`. A `200` is a finding. A `301`/`302` to the site homepage or a login page means **not exposed** — do not count it. Only treat a redirect as a finding if it points at the resource itself (e.g. `/.git/HEAD` → `/.git/HEAD/`).

## Step 1: Technology Detection

**Goal:** Fingerprint the technology stack to adapt the assessment plan.

Run ALL of the following checks **in parallel** (single message, multiple tool calls). Use the **canonical host** from Step 0.5 as `{domain}`.

### 1a. HTTP Headers Fingerprint
```bash
curl -sI --max-time 10 https://{domain} 2>/dev/null | head -40
```
Extract: `Server`, `X-Powered-By`, `X-Generator`, `X-Drupal-Cache`, `X-Magento-*`, `X-AspNet-Version`, `X-Redirect-By`, `Set-Cookie` names.

### 1b. Homepage Source Analysis
```bash
curl -sL --max-time 10 https://{domain} 2>/dev/null | head -500
```
Look for:
- `<meta name="generator">` — WordPress, Drupal, Joomla, Wix, Squarespace, etc.
- `data-reactroot`, `__NEXT_DATA__`, `_next/` — React / Next.js
- `ng-app`, `ng-version`, `angular` — Angular
- `data-v-`, `__vue__`, `__NUXT__` — Vue.js / Nuxt
- `wp-content`, `wp-includes` — WordPress
- `sites/default/files` — Drupal
- `media/`, `skin/` with Magento patterns — Magento
- `csrfmiddlewaretoken` — Django
- `laravel_session`, `XSRF-TOKEN` — Laravel
- `_rails`, `turbolinks`, `csrf-token` meta — Rails
- `__GATSBY`, `gatsby-` — Gatsby
- Shopify, Webflow, Ghost, or other SaaS indicators

### 1c. Common Technology Paths
```bash
# Check multiple known paths in parallel using curl
curl -sI --max-time 10 https://{domain}/wp-json/ 2>/dev/null | head -5
curl -sI --max-time 10 https://{domain}/api/ 2>/dev/null | head -5
curl -sI --max-time 10 https://{domain}/graphql 2>/dev/null | head -5
curl -sI --max-time 10 https://{domain}/.well-known/security.txt 2>/dev/null | head -10
curl -sI --max-time 10 https://{domain}/robots.txt 2>/dev/null | head -5
```

### 1d. Cookie Analysis
Look at `Set-Cookie` headers from step 1a:
- `PHPSESSID` → PHP
- `JSESSIONID` → Java
- `ASP.NET_SessionId` → ASP.NET
- `_session_id` → Ruby on Rails
- `csrftoken` → Django
- `laravel_session` → Laravel
- `wordpress_*` → WordPress
- `connect.sid` → Express.js/Node.js

### Technology Classification

After all checks complete, classify into one or more of these categories:

| Category | Technologies |
|----------|-------------|
| `wordpress` | WordPress (any version) |
| `drupal` | Drupal |
| `joomla` | Joomla |
| `php-generic` | PHP (non-CMS or unknown framework) |
| `laravel` | Laravel |
| `django` | Django |
| `rails` | Ruby on Rails |
| `dotnet` | ASP.NET / .NET |
| `java` | Java / Spring / JSP |
| `node` | Node.js / Express |
| `nextjs` | Next.js |
| `react-spa` | React (client-side SPA) |
| `angular` | Angular |
| `vue` | Vue.js / Nuxt |
| `static` | Static site / JAMstack |
| `saas-cms` | Wix, Squarespace, Webflow, Shopify |
| `unknown` | Could not determine |

Record ALL detected technologies. A site can have multiple (e.g., `wordpress` + `php-generic`).

## Step 2: Build Assessment Plan

Based on detected technologies, assemble the assessment plan from the module library below. Track the selected modules as a checklist with TodoWrite (one item per module) so progress is visible and nothing is skipped.

**Always include these universal modules:**
- Module U1: Passive Reconnaissance
- Module U2: HTTP Security Headers
- Module U3: SSL/TLS Analysis (unless `--skip-ssl`)
- Module U4: Information Disclosure
- Module U5: GDPR & Regulatory Compliance (unless `--skip-gdpr`)
- Module U6: DNS & Email Security

**Add technology-specific modules:**
- WordPress → Module WP1
- Drupal → Module DR1
- Joomla → Module JM1
- PHP (any) → Module PHP1
- Laravel → Module LR1
- Django → Module DJ1
- Rails → Module RB1
- Node.js / Express → Module ND1
- Next.js → Module NX1
- React/Angular/Vue SPA → Module SPA1
- .NET → Module DN1
- Java → Module JV1
- SaaS CMS → Module SAAS1

**Active modules (ONLY when `--active` is passed):**
- Module A1: Open Redirect — runs regardless of stack. If `--active` is absent, do NOT add it and note in the report that active checks were not requested.

---

## Module Library

> **Curl normalization (applies to EVERY snippet below, no exceptions):**
> Before running any command in this document, ensure each `curl` invocation carries `--max-time 10` (a connect+transfer ceiling so a single hanging or tarpitted host cannot stall the run — the audit fires dozens of probes and a 2-minute Bash timeout per stuck call would blow the budget). Many snippets already show the flag; if one is missing it, add it. Use `-sL` for content-analysis fetches and `-sI` (no `-L`) for path-existence probes, per the redirect policy in Step 0.5. Probe the **canonical host** from Step 0.5, not the raw argument.

### Module U1: Passive Reconnaissance

```bash
# robots.txt
curl -s --max-time 10 https://{domain}/robots.txt 2>/dev/null

# Sitemap
curl -s --max-time 10 https://{domain}/sitemap.xml 2>/dev/null | head -100
curl -s --max-time 10 https://{domain}/sitemap_index.xml 2>/dev/null | head -100

# security.txt (both standard locations)
curl -s --max-time 10 https://{domain}/.well-known/security.txt 2>/dev/null
curl -sI --max-time 10 https://{domain}/security.txt 2>/dev/null | head -5

# Other .well-known resources (informational; reveal posture and email policy)
curl -sI --max-time 10 https://{domain}/.well-known/change-password 2>/dev/null | head -5
curl -s  --max-time 10 https://{domain}/.well-known/mta-sts.txt 2>/dev/null | head -10
curl -sI --max-time 10 https://{domain}/.well-known/apple-app-site-association 2>/dev/null | head -5
curl -sI --max-time 10 https://{domain}/.well-known/assetlinks.json 2>/dev/null | head -5

# humans.txt
curl -sI --max-time 10 https://{domain}/humans.txt 2>/dev/null | head -5

# Homepage source — extract all external scripts, stylesheets, and meta tags
curl -sL --max-time 10 https://{domain} 2>/dev/null | grep -iE '(src=|href=|<meta|<link|<script)' | head -60

# Mixed content — http:// resource references served from an HTTPS page (passive/active content over cleartext)
curl -sL --max-time 10 https://{domain} 2>/dev/null | grep -oiE '(src|href)="http://[^"]+"' | head -20

# Check for common info-leak files (path-existence probes — do NOT follow redirects)
curl -sI --max-time 10 https://{domain}/.git/HEAD 2>/dev/null | head -5
curl -sI --max-time 10 https://{domain}/.env 2>/dev/null | head -5
curl -sI --max-time 10 https://{domain}/.svn/entries 2>/dev/null | head -5
curl -sI --max-time 10 https://{domain}/crossdomain.xml 2>/dev/null | head -5
```

Use WebFetch for robots.txt and sitemap to get full parsed content.

Record: all discovered paths, technology indicators, external dependencies, and any `http://` references on the HTTPS homepage (mixed content → [OWASP A02:2021](https://owasp.org/Top10/A02_2021-Cryptographic_Failures/)).

### Module U2: HTTP Security Headers

```bash
curl -sI --max-time 10 https://{domain} 2>/dev/null
```

Check for the presence and correctness of each header:

| Header | Expected | Severity if Missing |
|--------|----------|-------------------|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` (note `preload` if eligible) | HIGH |
| `Content-Security-Policy` | Restrictive policy | HIGH |
| `X-Content-Type-Options` | `nosniff` | MEDIUM |
| `X-Frame-Options` | `DENY` or `SAMEORIGIN` (or CSP `frame-ancestors`) | MEDIUM |
| `Referrer-Policy` | `strict-origin-when-cross-origin` or stricter | MEDIUM |
| `Permissions-Policy` | Restrict camera, microphone, geolocation | LOW |
| `Cross-Origin-Opener-Policy` | `same-origin` | LOW |
| `Cross-Origin-Resource-Policy` | `same-origin` or `same-site` | LOW |
| `Cross-Origin-Embedder-Policy` | `require-corp` (if isolation needed) | INFO |
| `X-XSS-Protection` | `0` (CSP supersedes) or `1; mode=block` | LOW |
| `Cache-Control` | `no-store` for sensitive pages | LOW |

Also check:
- `Server` header — should not reveal version details
- `X-Powered-By` — should not be present
- `X-AspNet-Version` — should not be present
- CORS headers (`Access-Control-Allow-Origin`) — should not be `*` wildcard

**CSP weakness analysis (if a `Content-Security-Policy` is present):** a present-but-weak policy is a real finding, not a pass. Flag any of:
- `unsafe-inline` or `unsafe-eval` in `script-src`/`default-src` ([OWASP A03:2021](https://owasp.org/Top10/A03_2021-Injection/))
- Wildcard sources (`*`, `https:`, `data:` in `script-src`)
- Missing `object-src 'none'` and missing `frame-ancestors`
- `default-src` absent (no fallback)

**Cookie security attributes:** inspect every `Set-Cookie` from the response above. Each cookie — especially session cookies (`*SESS*`, `JSESSIONID`, `PHPSESSID`, `connect.sid`, auth tokens) — should carry `Secure`, `HttpOnly`, and `SameSite=Lax|Strict`. Missing `Secure`/`HttpOnly` on a session cookie is a finding ([OWASP A05:2021](https://owasp.org/Top10/A05_2021-Security_Misconfiguration/); session-cookie exposure also engages [GDPR Art. 32](https://gdpr-info.eu/art-32-gdpr/)).

**CORS reflection probe (non-destructive — a single GET with a forged `Origin`):**
```bash
curl -sI --max-time 10 -H "Origin: https://evil.example" https://{domain} 2>/dev/null | grep -iE 'access-control-allow-(origin|credentials)'
```
Finding if the server reflects the attacker origin back in `Access-Control-Allow-Origin` (especially together with `Access-Control-Allow-Credentials: true`) — that is an exploitable CORS misconfiguration ([OWASP A05:2021](https://owasp.org/Top10/A05_2021-Security_Misconfiguration/)).

**Allowed HTTP methods (safe `OPTIONS` preflight — read-only, mutates nothing):**
```bash
curl -sI --max-time 10 -X OPTIONS https://{domain} 2>/dev/null | grep -iE '(allow|access-control-allow-methods)'
```
Flag if `PUT`, `DELETE`, `PATCH`, `TRACE`, or `CONNECT` are advertised as allowed on a host that should not accept them. `TRACE` enabled → potential Cross-Site Tracing.

### Module U3: SSL/TLS Analysis

```bash
# Certificate details
echo | openssl s_client -servername {domain} -connect {domain}:443 2>/dev/null | openssl x509 -noout -subject -issuer -dates -serial 2>/dev/null

# Protocol and cipher
echo | openssl s_client -servername {domain} -connect {domain}:443 2>/dev/null | grep -iE '(Protocol|Cipher|TLSv)' | head -10

# HTTP to HTTPS redirect
curl -sI --max-time 10 http://{domain} 2>/dev/null | head -10

# Check for TLS 1.2 support (should succeed)
echo | openssl s_client -servername {domain} -connect {domain}:443 -tls1_2 2>&1 | head -5

# Legacy protocol probes — these should FAIL on a well-configured host.
# A successful handshake here is a finding (deprecated, exploitable protocols enabled).
echo | openssl s_client -servername {domain} -connect {domain}:443 -tls1_1 2>&1 | grep -iE '(Protocol|Cipher|handshake failure|no protocols available|alert)' | head -5
echo | openssl s_client -servername {domain} -connect {domain}:443 -tls1   2>&1 | grep -iE '(Protocol|Cipher|handshake failure|no protocols available|alert)' | head -5
```

Evaluate:
- Certificate validity and expiration (flag if expiring within 30 days)
- Issuer (Let's Encrypt, DigiCert, etc.)
- TLS version (1.3 = excellent, 1.2 = acceptable, 1.1/1.0 = CRITICAL). **A successful TLS 1.0/1.1 handshake from the legacy probes above is a CRITICAL finding** ([OWASP A02:2021](https://owasp.org/Top10/A02_2021-Cryptographic_Failures/)).
- Cipher suite strength
- HTTP→HTTPS redirect presence
- Certificate covers the correct domain(s)

### Module U4: Information Disclosure

```bash
# Common backup and config files (path-existence probes — do NOT follow redirects)
curl -sI --max-time 10 https://{domain}/backup.zip 2>/dev/null | head -5
curl -sI --max-time 10 https://{domain}/backup.sql 2>/dev/null | head -5
curl -sI --max-time 10 https://{domain}/dump.sql 2>/dev/null | head -5
curl -sI --max-time 10 https://{domain}/database.sql 2>/dev/null | head -5
curl -sI --max-time 10 https://{domain}/db.sql 2>/dev/null | head -5
curl -sI --max-time 10 https://{domain}/.DS_Store 2>/dev/null | head -5
curl -sI --max-time 10 https://{domain}/Thumbs.db 2>/dev/null | head -5
curl -sI --max-time 10 https://{domain}/web.config 2>/dev/null | head -5
curl -sI --max-time 10 https://{domain}/elmah.axd 2>/dev/null | head -5
curl -sI --max-time 10 https://{domain}/server-status 2>/dev/null | head -5
curl -sI --max-time 10 https://{domain}/server-info 2>/dev/null | head -5
```

> **Dedupe:** the PHP probes (`phpinfo.php`, `info.php`, `test.php`, `adminer.php`, `phpmyadmin/`) live in **Module PHP1**. If PHP1 is in the plan, do **not** repeat them here — running both wastes calls against the same host. If PHP1 is *not* in the plan but you still want a baseline PHP sweep, run those five from PHP1 instead.

Any HTTP 200 response on these paths is a finding. Per the Step 0.5 redirect policy, a `301`/`302` to the homepage or login page is **not** a finding.

### Module U5: GDPR & Regulatory Compliance

Use WebFetch to analyze the homepage for compliance elements:

**5a. Cookie Consent:**
```bash
# (i) Inline banner markup / config that some platforms DO emit server-side
curl -sL --max-time 10 https://{domain} 2>/dev/null | grep -iE '(cookie-consent|cookie-notice|cookiebot|onetrust|quantcast|trustarc|complianz|iubenda|CookieConsent|cookie-banner|gdpr|cc-window|cc-banner)' | head -20

# (ii) Consent-vendor LOADER script tags — these ARE present in static HTML even when the banner itself is injected by JS
curl -sL --max-time 10 https://{domain} 2>/dev/null | grep -oiE 'src="[^"]*(cookiebot\.com/uc\.js|cookielaw\.org|onetrust|otSDKStub|trustarc|consent\.cookiebot|cookieyes|termly\.io|usercentrics|iubenda\.com/(autoblocking|cs))[^"]*"' | head -20
```

> **CRITICAL ACCURACY RULE (avoid false positives):** Most consent banners (Cookiebot, OneTrust, Usercentrics, CookieYes) are **injected by JavaScript**. `curl`/`grep` see only static HTML and `WebFetch` does **not** execute JS, so a banner missing from the raw HTML does **not** prove the site has no consent mechanism. Therefore:
> - If probe (ii) finds a vendor loader script tag → the site **has** a consent platform. Do **not** report "no cookie consent."
> - If neither (i) nor (ii) matches → mark the cookie-consent finding **INCONCLUSIVE (requires a JS-rendered check)**, not a confirmed violation. Only escalate to a confirmed finding when probe (iii) below shows tracking cookies/scripts firing with no consent vendor present at all.

**5b. Tracking Scripts (pre-consent):**
```bash
curl -sL --max-time 10 https://{domain} 2>/dev/null | grep -iE '(google-analytics|gtag|ga\(|googletagmanager|facebook|fbq|pixel|hotjar|mixpanel|segment|amplitude|clarity\.ms|plausible|matomo|piwik)' | head -20
```

> (iii) **Confirmed violation pattern:** tracking scripts present in 5b **AND** no consent vendor found in 5a → likely tracking-before-consent ([GDPR Art. 6](https://gdpr-info.eu/art-6-gdpr/), [ePrivacy Art. 5(3)](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32002L0058#d1e840-37-1)). Note that loading order (consent gating) cannot be fully proven without a JS-rendered session — state that limitation in the finding.

**5c. Privacy Policy:**
```bash
curl -sL --max-time 10 https://{domain} 2>/dev/null | grep -iE '(privacy|datenschutz|confidentialit)' | head -10
```

If a privacy policy link is found, use WebFetch to analyze it for:
- Lawful basis stated (consent, legitimate interest, contract)
- Data subject rights listed (access, rectification, erasure, portability, objection, restriction, automated decision-making)
- DPO contact information
- Cookie policy section
- International data transfer mechanisms
- Data retention periods
- Third-party data sharing disclosures
- Children's data protection (if applicable)
- Breach notification procedures

**5d. Data Collection Forms:**
Use WebFetch on the homepage and any form pages found in the sitemap:
- Are there consent checkboxes on data collection forms?
- Is consent explicit (opt-in) or implicit (pre-checked or by-action)?
- Are required legal notices present near forms?

**5e. Regulatory Scope Assessment:**
Based on the company's location and target audience, note which regulations may apply:
- **GDPR** (EU/EEA) — if site targets or processes EU resident data
- **UK GDPR** — if site targets UK
- **CCPA/CPRA** — if site targets California residents
- **LGPD** — if site targets Brazil
- **PIPEDA** — if site targets Canada
- **ePrivacy Directive** — cookie consent for EU

### Module U6: DNS & Email Security

**Why:** Missing or weak SPF/DKIM/DMARC lets attackers spoof email from the domain (phishing, BEC) — one of the most common *real* findings on otherwise-tidy sites, and invisible to HTTP probing. We query DNS over HTTPS (DoH) via `curl` so no extra tooling is needed and the calls stay inside the permission allowlist. Query the **registrable domain** (strip `www.`).

```bash
# SPF (and any other root TXT) — look for a "v=spf1 ..." record
curl -s --max-time 10 "https://dns.google/resolve?name={domain}&type=TXT" 2>/dev/null

# DMARC policy
curl -s --max-time 10 "https://dns.google/resolve?name=_dmarc.{domain}&type=TXT" 2>/dev/null

# DKIM — common selectors (absence here is not conclusive; selectors are arbitrary)
curl -s --max-time 10 "https://dns.google/resolve?name=google._domainkey.{domain}&type=TXT" 2>/dev/null
curl -s --max-time 10 "https://dns.google/resolve?name=default._domainkey.{domain}&type=TXT" 2>/dev/null
curl -s --max-time 10 "https://dns.google/resolve?name=selector1._domainkey.{domain}&type=TXT" 2>/dev/null

# CAA — restricts which CAs may issue certs for the domain
curl -s --max-time 10 "https://dns.google/resolve?name={domain}&type=CAA" 2>/dev/null

# MX — does the domain receive mail at all? (decides whether SPF/DMARC gaps matter operationally)
curl -s --max-time 10 "https://dns.google/resolve?name={domain}&type=MX" 2>/dev/null

# DNSSEC — AD (Authenticated Data) flag set by the resolver indicates a validated, signed zone
curl -s --max-time 10 "https://dns.google/resolve?name={domain}&type=A&do=1" 2>/dev/null
```

Evaluate (each maps to spoofing/phishing risk under [OWASP A07:2021](https://owasp.org/Top10/A07_2021-Identification_and_Authentication_Failures/) and security-of-processing under [GDPR Art. 32](https://gdpr-info.eu/art-32-gdpr/)):

| Check | Finding condition | Severity |
|-------|-------------------|----------|
| **SPF** | No `v=spf1` TXT record, OR record ends in `+all`/`?all` (permissive) | MEDIUM (HIGH if domain has MX) |
| **DMARC** | No `_dmarc` record, OR `p=none` (monitor-only, no enforcement) | MEDIUM |
| **DKIM** | No DKIM record on any common selector (note: inconclusive — report as "not found on common selectors") | LOW |
| **CAA** | No CAA record (any CA may issue) | LOW |
| **DNSSEC** | Response `AD` flag absent / zone unsigned | LOW |

In the DoH JSON, `"Status":0` = NOERROR (record exists if `Answer` present); `"Status":3` = NXDOMAIN (no such record). `"AD":true` at the top level means DNSSEC-validated.

### Module WP1: WordPress-Specific Checks

```bash
# WordPress version indicators
curl -s --max-time 10 https://{domain} 2>/dev/null | grep -iE '(generator|ver=|wp-includes|wp-content)' | head -30

# REST API full exposure
curl -s --max-time 10 https://{domain}/wp-json/ 2>/dev/null | head -500

# User enumeration
curl -s --max-time 10 https://{domain}/wp-json/wp/v2/users 2>/dev/null | head -100
curl -sI --max-time 10 "https://{domain}/?author=1" 2>/dev/null | head -15
curl -sI --max-time 10 "https://{domain}/?author=2" 2>/dev/null | head -15

# XML-RPC
curl -sI --max-time 10 https://{domain}/xmlrpc.php 2>/dev/null | head -10

# Login page
curl -sI --max-time 10 https://{domain}/wp-login.php 2>/dev/null | head -20

# WP-Cron
curl -sI --max-time 10 https://{domain}/wp-cron.php 2>/dev/null | head -10

# File exposure
curl -sI --max-time 10 https://{domain}/readme.html 2>/dev/null | head -5
curl -sI --max-time 10 https://{domain}/license.txt 2>/dev/null | head -5
curl -sI --max-time 10 https://{domain}/wp-content/debug.log 2>/dev/null | head -5
curl -sI --max-time 10 https://{domain}/wp-config.php 2>/dev/null | head -5
curl -sI --max-time 10 https://{domain}/wp-config.php.bak 2>/dev/null | head -5
curl -sI --max-time 10 https://{domain}/wp-config.php~ 2>/dev/null | head -5
curl -sI --max-time 10 https://{domain}/.wp-config.php.swp 2>/dev/null | head -5

# Directory listing
curl -sI --max-time 10 https://{domain}/wp-content/uploads/ 2>/dev/null | head -10
curl -sI --max-time 10 https://{domain}/wp-content/plugins/ 2>/dev/null | head -10
curl -sI --max-time 10 https://{domain}/wp-content/themes/ 2>/dev/null | head -10

# WPForms uploads (if wpforms detected)
curl -sI --max-time 10 https://{domain}/wp-content/uploads/wpforms/ 2>/dev/null | head -10

# Plugin enumeration from page source
curl -s --max-time 10 https://{domain} 2>/dev/null | grep -oE 'wp-content/plugins/[^/]+' | sort -u

# REST API namespace analysis (reveals installed plugins)
curl -s --max-time 10 https://{domain}/wp-json/ 2>/dev/null | grep -oE '"namespace":"[^"]+"' | sort -u
```

Flag as findings:
- Any 200 response on sensitive paths
- User enumeration success (usernames returned)
- XML-RPC accessible (brute force vector)
- Directory listing enabled
- Exposed debug.log, config backups
- Upload directories accessible without auth
- REST API route listing exposure (even if data endpoints require auth)

### Module DR1: Drupal-Specific Checks

```bash
curl -sI --max-time 10 https://{domain}/CHANGELOG.txt 2>/dev/null | head -5
curl -sI --max-time 10 https://{domain}/core/CHANGELOG.txt 2>/dev/null | head -5
curl -sI --max-time 10 https://{domain}/user/login 2>/dev/null | head -15
curl -sI --max-time 10 https://{domain}/admin 2>/dev/null | head -15
curl -sI --max-time 10 https://{domain}/node/1 2>/dev/null | head -15
curl -sI --max-time 10 https://{domain}/jsonapi 2>/dev/null | head -10
curl -sI --max-time 10 https://{domain}/jsonapi/user/user 2>/dev/null | head -10
curl -sI --max-time 10 https://{domain}/sites/default/files/ 2>/dev/null | head -10
curl -sI --max-time 10 https://{domain}/core/install.php 2>/dev/null | head -5
curl -s --max-time 10 https://{domain} 2>/dev/null | grep -iE '(drupal|sites/default)' | head -10
```

### Module JM1: Joomla-Specific Checks

```bash
curl -sI --max-time 10 https://{domain}/administrator/ 2>/dev/null | head -15
curl -sI --max-time 10 https://{domain}/configuration.php 2>/dev/null | head -5
curl -sI --max-time 10 https://{domain}/htaccess.txt 2>/dev/null | head -5
curl -sI --max-time 10 https://{domain}/web.config.txt 2>/dev/null | head -5
curl -s --max-time 10 https://{domain}/administrator/manifests/files/joomla.xml 2>/dev/null | grep -i version | head -5
curl -sI --max-time 10 https://{domain}/api/index.php/v1/users 2>/dev/null | head -10
curl -s --max-time 10 https://{domain} 2>/dev/null | grep -iE '(joomla|com_content|option=com_)' | head -10
```

### Module PHP1: Generic PHP Checks

```bash
curl -sI --max-time 10 https://{domain}/phpinfo.php 2>/dev/null | head -5
curl -sI --max-time 10 https://{domain}/info.php 2>/dev/null | head -5
curl -sI --max-time 10 https://{domain}/test.php 2>/dev/null | head -5
curl -sI --max-time 10 https://{domain}/adminer.php 2>/dev/null | head -5
curl -sI --max-time 10 https://{domain}/phpmyadmin/ 2>/dev/null | head -5
curl -sI --max-time 10 https://{domain}/pma/ 2>/dev/null | head -5
curl -sI --max-time 10 https://{domain}/.user.ini 2>/dev/null | head -5
curl -sI --max-time 10 https://{domain}/php.ini 2>/dev/null | head -5
```

### Module LR1: Laravel-Specific Checks

```bash
curl -sI --max-time 10 https://{domain}/.env 2>/dev/null | head -10
curl -sI --max-time 10 https://{domain}/storage/ 2>/dev/null | head -10
curl -sI --max-time 10 https://{domain}/storage/logs/laravel.log 2>/dev/null | head -10
curl -sI --max-time 10 https://{domain}/telescope 2>/dev/null | head -10
curl -sI --max-time 10 https://{domain}/horizon 2>/dev/null | head -10
curl -sI --max-time 10 https://{domain}/_debugbar 2>/dev/null | head -10
curl -sI --max-time 10 https://{domain}/vendor/phpunit/phpunit/src/Util/PHP/eval-stdin.php 2>/dev/null | head -5
curl -s --max-time 10 https://{domain} 2>/dev/null | grep -iE '(laravel|csrf-token|XSRF-TOKEN)' | head -10
```

### Module DJ1: Django-Specific Checks

```bash
curl -sI --max-time 10 https://{domain}/admin/ 2>/dev/null | head -15
curl -sI --max-time 10 https://{domain}/admin/login/ 2>/dev/null | head -15
curl -s --max-time 10 https://{domain}/admin/ 2>/dev/null | grep -i django | head -5
curl -sI --max-time 10 https://{domain}/__debug__/ 2>/dev/null | head -10
curl -sI --max-time 10 https://{domain}/api/swagger/ 2>/dev/null | head -10
curl -sI --max-time 10 https://{domain}/api/docs/ 2>/dev/null | head -10
curl -sI --max-time 10 https://{domain}/settings.py 2>/dev/null | head -5
curl -sI --max-time 10 https://{domain}/static/ 2>/dev/null | head -10
curl -sI --max-time 10 https://{domain}/media/ 2>/dev/null | head -10
# Check for DEBUG=True indicators
curl -s --max-time 10 https://{domain}/nonexistent-path-for-debug-check 2>/dev/null | grep -iE '(Traceback|DEBUG|Django|INSTALLED_APPS|SECRET_KEY)' | head -10
```

### Module RB1: Rails-Specific Checks

```bash
curl -sI --max-time 10 https://{domain}/rails/info/properties 2>/dev/null | head -10
curl -sI --max-time 10 https://{domain}/rails/mailers 2>/dev/null | head -10
curl -sI --max-time 10 https://{domain}/sidekiq 2>/dev/null | head -10
curl -sI --max-time 10 https://{domain}/flipper 2>/dev/null | head -10
curl -sI --max-time 10 https://{domain}/letter_opener 2>/dev/null | head -10
curl -s --max-time 10 https://{domain}/nonexistent-path-for-debug-check 2>/dev/null | grep -iE '(ActionController|Rails|ActiveRecord|RAILS_ENV)' | head -10
```

### Module ND1: Node.js / Express Checks

```bash
curl -sI --max-time 10 https://{domain}/package.json 2>/dev/null | head -5
curl -sI --max-time 10 https://{domain}/npm-debug.log 2>/dev/null | head -5
curl -sI --max-time 10 https://{domain}/yarn-error.log 2>/dev/null | head -5
curl -sI --max-time 10 https://{domain}/.npmrc 2>/dev/null | head -5
curl -sI --max-time 10 https://{domain}/node_modules/ 2>/dev/null | head -5
curl -sI --max-time 10 https://{domain}/swagger.json 2>/dev/null | head -5
curl -sI --max-time 10 https://{domain}/api-docs 2>/dev/null | head -5
curl -sI --max-time 10 https://{domain}/graphql 2>/dev/null | head -10
curl -sI --max-time 10 https://{domain}/health 2>/dev/null | head -5
curl -sI --max-time 10 https://{domain}/healthz 2>/dev/null | head -5
# Check for verbose error responses
curl -s --max-time 10 "https://{domain}/nonexistent-path-for-debug-check" 2>/dev/null | grep -iE '(at Object|at Module|node_modules|TypeError|ReferenceError|stack.*trace)' | head -10
```

### Module NX1: Next.js Checks

```bash
curl -sI --max-time 10 https://{domain}/_next/static/ 2>/dev/null | head -5
curl -sI --max-time 10 https://{domain}/api/health 2>/dev/null | head -5
curl -sL --max-time 10 https://{domain} 2>/dev/null | grep -oE '"buildId":"[^"]+"' | head -3
# Source maps (curl-led pipeline — matches the Bash(curl *) allowlist)
curl -sL --max-time 10 https://{domain} 2>/dev/null | grep -oE '_next/static/[^"]+\.js' | head -5 | while read -r js; do curl -sI --max-time 10 "https://{domain}/${js}.map" 2>/dev/null | head -3; done
```

### Module SPA1: SPA Framework Checks (React/Angular/Vue)

```bash
# Source maps exposure — list script bundles
curl -sL --max-time 10 https://{domain} 2>/dev/null | grep -oE 'src="[^"]*\.js"' | head -10

# Probe each bundle for an adjacent .map source map.
# NOTE: written as a single curl-led pipeline (no `VAR=$(...)`/`if` prefix) so it matches the
# Bash(curl *) allowlist and never triggers a permission prompt mid-run. See Rules.
curl -sL --max-time 10 https://{domain} 2>/dev/null | grep -oE 'src="[^"]*\.js"' | sed 's/src="//;s/"//' | head -5 | while read -r js; do curl -sI --max-time 10 "https://{domain}/${js}.map" 2>/dev/null | head -3; done

# Common SPA config leaks (path-existence probes — do NOT follow redirects)
curl -sI --max-time 10 https://{domain}/config.js 2>/dev/null | head -5
curl -sI --max-time 10 https://{domain}/env.js 2>/dev/null | head -5
curl -sI --max-time 10 https://{domain}/runtime-config.js 2>/dev/null | head -5
curl -sI --max-time 10 https://{domain}/.env 2>/dev/null | head -5
curl -sI --max-time 10 https://{domain}/.env.local 2>/dev/null | head -5
curl -sI --max-time 10 https://{domain}/.env.production 2>/dev/null | head -5
```

### Module DN1: .NET Checks

```bash
curl -sI --max-time 10 https://{domain}/web.config 2>/dev/null | head -5
curl -sI --max-time 10 https://{domain}/elmah.axd 2>/dev/null | head -5
curl -sI --max-time 10 https://{domain}/trace.axd 2>/dev/null | head -5
curl -sI --max-time 10 https://{domain}/swagger/index.html 2>/dev/null | head -10
curl -sI --max-time 10 https://{domain}/hangfire 2>/dev/null | head -10
curl -s --max-time 10 "https://{domain}/nonexistent-path-for-debug-check" 2>/dev/null | grep -iE '(ASP\.NET|Stack Trace|Server Error|customErrors)' | head -10
```

### Module JV1: Java Checks

```bash
curl -sI --max-time 10 https://{domain}/actuator 2>/dev/null | head -10
curl -sI --max-time 10 https://{domain}/actuator/health 2>/dev/null | head -10
curl -sI --max-time 10 https://{domain}/actuator/env 2>/dev/null | head -10
curl -sI --max-time 10 https://{domain}/actuator/info 2>/dev/null | head -10
curl -sI --max-time 10 https://{domain}/actuator/configprops 2>/dev/null | head -10
curl -sI --max-time 10 https://{domain}/swagger-ui.html 2>/dev/null | head -10
curl -sI --max-time 10 https://{domain}/swagger-ui/index.html 2>/dev/null | head -10
curl -sI --max-time 10 https://{domain}/v2/api-docs 2>/dev/null | head -10
curl -sI --max-time 10 https://{domain}/v3/api-docs 2>/dev/null | head -10
curl -sI --max-time 10 https://{domain}/jolokia 2>/dev/null | head -10
curl -sI --max-time 10 https://{domain}/console 2>/dev/null | head -10
curl -sI --max-time 10 https://{domain}/manager/html 2>/dev/null | head -10
curl -sI --max-time 10 https://{domain}/WEB-INF/web.xml 2>/dev/null | head -5
```

### Module SAAS1: SaaS CMS Checks (Wix/Squarespace/Shopify/Webflow)

For SaaS platforms, security of the infrastructure is managed by the vendor. Focus on:
- Configuration-level security (admin access, exposed APIs)
- Third-party integrations and scripts
- GDPR compliance (cookie consent, privacy policy)
- Content security (exposed drafts, internal pages)
- Custom code injections and their security

```bash
# Check for exposed admin paths
curl -sI --max-time 10 https://{domain}/admin 2>/dev/null | head -10
# Check for API exposure
curl -sI --max-time 10 https://{domain}/api/ 2>/dev/null | head -10
# Check for development/staging indicators
curl -s --max-time 10 https://{domain} 2>/dev/null | grep -iE '(staging|preview|draft|dev\.)' | head -5
```

---

## Active Check Tier (opt-in — only runs with `--active`)

> Skip this entire section unless `--active` was passed. These checks inject crafted input instead of only observing. They remain **non-destructive** (`GET`/`HEAD` only, no state change, redirects are inspected — never followed off-site), but because they probe with attacker-style payloads they are gated behind explicit opt-in.

### Module A1: Open Redirect

**What it tests:** whether the app reflects an attacker-supplied URL into a redirect `Location` (or a `<meta http-equiv=refresh>` / JS redirect), letting an attacker bounce victims to a phishing site through the trusted domain. Maps to [OWASP A01:2021](https://owasp.org/Top10/A01_2021-Broken_Access_Control/) (unvalidated redirect/forward).

**Canary target:** `https://example.com/` — `example.com` is an RFC 2606 reserved documentation domain, so it can never be confused with a real destination and is unmistakable in the target's logs. **Do NOT** use a real third-party domain as the canary.

```bash
# Common redirect parameters on the homepage (HEAD — inspect Location, never follow off-site)
curl -sI --max-time 10 "https://{domain}/?url=https://example.com/"        2>/dev/null | grep -i '^location:'
curl -sI --max-time 10 "https://{domain}/?next=https://example.com/"       2>/dev/null | grep -i '^location:'
curl -sI --max-time 10 "https://{domain}/?redirect=https://example.com/"   2>/dev/null | grep -i '^location:'
curl -sI --max-time 10 "https://{domain}/?redirect_uri=https://example.com/" 2>/dev/null | grep -i '^location:'
curl -sI --max-time 10 "https://{domain}/?return=https://example.com/"     2>/dev/null | grep -i '^location:'
curl -sI --max-time 10 "https://{domain}/?returnUrl=https://example.com/"   2>/dev/null | grep -i '^location:'
curl -sI --max-time 10 "https://{domain}/?dest=https://example.com/"       2>/dev/null | grep -i '^location:'
curl -sI --max-time 10 "https://{domain}/?continue=https://example.com/"   2>/dev/null | grep -i '^location:'
curl -sI --max-time 10 "https://{domain}/?goto=https://example.com/"       2>/dev/null | grep -i '^location:'

# Parser-bypass variants (scheme-relative and encoded — catch naive "starts with http" allowlists)
curl -sI --max-time 10 "https://{domain}/?url=//example.com/"              2>/dev/null | grep -i '^location:'
curl -sI --max-time 10 "https://{domain}/?url=https:%2f%2fexample.com%2f"  2>/dev/null | grep -i '^location:'

# Common dedicated redirect endpoints
curl -sI --max-time 10 "https://{domain}/redirect?url=https://example.com/" 2>/dev/null | grep -i '^location:'
curl -sI --max-time 10 "https://{domain}/out?url=https://example.com/"      2>/dev/null | grep -i '^location:'
curl -sI --max-time 10 "https://{domain}/login?next=https://example.com/"   2>/dev/null | grep -i '^location:'
curl -sI --max-time 10 "https://{domain}/logout?redirect=https://example.com/" 2>/dev/null | grep -i '^location:'
```

**Finding criteria — be strict to avoid false positives:**
- **Vulnerable** only if the response is a `30x` AND the `Location` host resolves to the off-site canary `example.com` (i.e. the app sends the victim off-domain to attacker-controlled input).
- A `Location` pointing back to the **same canonical host** (the app stripped/ignored the param) is **safe** — not a finding.
- A `200`/`404`/`400` with no redirect is **safe** — the parameter was ignored or rejected.
- Test only the parameters above; do **not** brute-force large wordlists. If none reflect, record open-redirect as **tested, not present**.

When `--active` is **not** set, the report's open-redirect line reads: *"Open-redirect testing not performed (active tier not requested; re-run with `--active`)."*

---

## Step 3: Execute Assessment

Execute all selected modules. Follow these rules:

1. **Run checks in parallel** where possible — use multiple Bash calls in a single message
2. **Never perform destructive actions** — every request is read-only and idempotent: `GET`, `HEAD`, and the safe `OPTIONS` preflight only. Never `POST`, `PUT`, `PATCH`, `DELETE`, or any state-changing method.
3. **Never attempt authentication** — no login attempts, no credential testing, no brute force
4. **No document or binary downloads** — for path-existence probes use `HEAD` (`curl -sI`). You MAY `GET` small text resources (HTML, JSON, robots.txt, DoH responses) for analysis, but never download or save document files, database dumps, archives, or binaries.
5. **Record every finding** with: URL tested, HTTP status code, response headers, severity rating
6. **For any 200 response on a sensitive path**, also fetch the first few lines of the body to confirm the finding (a `GET` of text only — see rule 4)
7. **Use WebFetch** for pages that need content analysis (privacy policy, forms, sitemaps). Remember WebFetch does **not** execute JavaScript — apply the inconclusive-result rule from Module U5 to anything JS-rendered.
8. **Respect the redirect policy** from Step 0.5: `-L` for content fetches, no `-L` for path-existence probes, and never count a redirect-to-homepage/login as an exposure.
9. **Keep commands curl-led** — every Bash snippet must begin with `curl`, `echo`, `openssl`, `npx`, or `docker run` so it matches the `allowed-tools` allowlist. Never start a command with `VAR=$(...)`, `if`, or a bare `while`/subshell — those fall outside `Bash(curl *)` and will stall the autonomous run on a permission prompt. Push loops to the **end** of a `curl ... | ... | while read` pipeline.

### Severity Classification

| Level | Criteria |
|-------|----------|
| **CRITICAL** | Active data breach, PII exposure, authentication bypass, RCE vectors |
| **HIGH** | Missing critical security controls, sensitive config/log exposure, significant GDPR violations |
| **MEDIUM** | Information disclosure that aids attack planning, missing recommended headers, partial GDPR gaps |
| **LOW** | Minor information leakage, best practice deviations, cosmetic security issues |
| **INFO** | Positive security controls observed, neutral observations |

### Regulatory Reference Links

Every finding MUST include clickable links to the specific regulation articles that apply. Use the exact URLs below — do not fabricate links.

#### OWASP Top 10 (2021)

| ID | Name | URL |
|----|------|-----|
| A01:2021 | Broken Access Control | https://owasp.org/Top10/A01_2021-Broken_Access_Control/ |
| A02:2021 | Cryptographic Failures | https://owasp.org/Top10/A02_2021-Cryptographic_Failures/ |
| A03:2021 | Injection | https://owasp.org/Top10/A03_2021-Injection/ |
| A04:2021 | Insecure Design | https://owasp.org/Top10/A04_2021-Insecure_Design/ |
| A05:2021 | Security Misconfiguration | https://owasp.org/Top10/A05_2021-Security_Misconfiguration/ |
| A06:2021 | Vulnerable and Outdated Components | https://owasp.org/Top10/A06_2021-Vulnerable_and_Outdated_Components/ |
| A07:2021 | Identification and Authentication Failures | https://owasp.org/Top10/A07_2021-Identification_and_Authentication_Failures/ |
| A08:2021 | Software and Data Integrity Failures | https://owasp.org/Top10/A08_2021-Software_and_Data_Integrity_Failures/ |
| A09:2021 | Security Logging and Monitoring Failures | https://owasp.org/Top10/A09_2021-Security_Logging_and_Monitoring_Failures/ |
| A10:2021 | Server-Side Request Forgery | https://owasp.org/Top10/A10_2021-Server-Side_Request_Forgery_%28SSRF%29/ |

#### GDPR (EU General Data Protection Regulation)

URL pattern: `https://gdpr-info.eu/art-{N}-gdpr/`

Key articles and their direct links:

| Article | Topic | URL |
|---------|-------|-----|
| Art. 5 | Principles of processing | https://gdpr-info.eu/art-5-gdpr/ |
| Art. 6 | Lawfulness of processing | https://gdpr-info.eu/art-6-gdpr/ |
| Art. 7 | Conditions for consent | https://gdpr-info.eu/art-7-gdpr/ |
| Art. 12 | Transparent information | https://gdpr-info.eu/art-12-gdpr/ |
| Art. 13 | Information to be provided (direct collection) | https://gdpr-info.eu/art-13-gdpr/ |
| Art. 14 | Information to be provided (indirect collection) | https://gdpr-info.eu/art-14-gdpr/ |
| Art. 15 | Right of access | https://gdpr-info.eu/art-15-gdpr/ |
| Art. 17 | Right to erasure | https://gdpr-info.eu/art-17-gdpr/ |
| Art. 20 | Right to data portability | https://gdpr-info.eu/art-20-gdpr/ |
| Art. 22 | Automated individual decision-making | https://gdpr-info.eu/art-22-gdpr/ |
| Art. 25 | Data protection by design and by default | https://gdpr-info.eu/art-25-gdpr/ |
| Art. 32 | Security of processing | https://gdpr-info.eu/art-32-gdpr/ |
| Art. 33 | Notification of breach to authority | https://gdpr-info.eu/art-33-gdpr/ |
| Art. 34 | Communication of breach to data subject | https://gdpr-info.eu/art-34-gdpr/ |
| Art. 35 | Data protection impact assessment | https://gdpr-info.eu/art-35-gdpr/ |
| Art. 37 | Designation of DPO | https://gdpr-info.eu/art-37-gdpr/ |
| Art. 44 | General principle for transfers | https://gdpr-info.eu/art-44-gdpr/ |
| Art. 46 | Transfers subject to safeguards | https://gdpr-info.eu/art-46-gdpr/ |

#### Swiss FADP (Federal Act on Data Protection / nDSG)

Base URL: `https://www.fedlex.admin.ch/eli/cc/2022/491/en`

| Article | Topic | URL |
|---------|-------|-----|
| Art. 6 | Principles | https://www.fedlex.admin.ch/eli/cc/2022/491/en#art_6 |
| Art. 7 | Data protection by design and by default | https://www.fedlex.admin.ch/eli/cc/2022/491/en#art_7 |
| Art. 8 | Data security | https://www.fedlex.admin.ch/eli/cc/2022/491/en#art_8 |
| Art. 16 | Cross-border disclosure (principles) | https://www.fedlex.admin.ch/eli/cc/2022/491/en#art_16 |
| Art. 17 | Cross-border disclosure (exceptions) | https://www.fedlex.admin.ch/eli/cc/2022/491/en#art_17 |
| Art. 19 | Information obligation (collection) | https://www.fedlex.admin.ch/eli/cc/2022/491/en#art_19 |
| Art. 21 | Right of access | https://www.fedlex.admin.ch/eli/cc/2022/491/en#art_21 |
| Art. 24 | Notification of data breach to FDPIC | https://www.fedlex.admin.ch/eli/cc/2022/491/en#art_24 |
| Art. 25 | Right to data portability | https://www.fedlex.admin.ch/eli/cc/2022/491/en#art_25 |
| Art. 22 | Automated individual decisions | https://www.fedlex.admin.ch/eli/cc/2022/491/en#art_22 |

#### CCPA/CPRA (California Consumer Privacy Act / California Privacy Rights Act)

URL pattern: `https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?sectionNum=1798.{N}.&lawCode=CIV`

| Section | Topic | URL |
|---------|-------|-----|
| §1798.100 | Right to know / access | https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?sectionNum=1798.100.&lawCode=CIV |
| §1798.105 | Right to delete | https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?sectionNum=1798.105.&lawCode=CIV |
| §1798.110 | Right to know what is collected | https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?sectionNum=1798.110.&lawCode=CIV |
| §1798.120 | Right to opt-out of sale | https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?sectionNum=1798.120.&lawCode=CIV |
| §1798.121 | Right to opt-out of sharing | https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?sectionNum=1798.121.&lawCode=CIV |
| §1798.125 | Non-discrimination | https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?sectionNum=1798.125.&lawCode=CIV |
| §1798.130 | Business compliance requirements | https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?sectionNum=1798.130.&lawCode=CIV |
| §1798.135 | Methods for opt-out requests | https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?sectionNum=1798.135.&lawCode=CIV |
| §1798.140 | Definitions | https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?sectionNum=1798.140.&lawCode=CIV |
| §1798.150 | Private right of action (data breaches) | https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?sectionNum=1798.150.&lawCode=CIV |

#### ePrivacy Directive

| Article | Topic | URL |
|---------|-------|-----|
| Art. 5(3) | Cookie consent requirement | https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32002L0058#d1e840-37-1 |

## Step 4: Generate Report

Write the Markdown report to `{domain}-security-audit-{YYYY-MM-DD}.md` in the **report directory** (`--out <dir>` if provided, otherwise the current working directory). Use this structure:

```markdown
# Security & Compliance Assessment Report

**Target:** {url} (canonical host: {canonical_host})
**Domain:** {domain}
**Date:** {YYYY-MM-DD}
**Assessment Type:** Non-destructive external security assessment
**Check Tier:** {if --active: "Passive + Active (open-redirect probing enabled)"; else: "Passive only (re-run with `--active` for open-redirect checks)"}
**Authorization:** {if --authorized-by given: "Authorized by {name}"; else: "Performed at the request of the operator who invoked this assessment, who attests they are authorized to test this target."}

---

## Executive Summary

[2-3 sentence overview of overall security posture]

**Finding Summary:**

| Severity | Count |
|----------|-------|
| Critical | N |
| High | N |
| Medium | N |
| Low | N |
| Informational | N |

---

## Technology Stack Detected

| Component | Details |
|-----------|---------|
| ... | ... |

---

## Findings

### CRITICAL

#### {ID}: {Title}

**Severity:** CRITICAL
**CVSS Estimate:** {score}
**Category:** {Category description} ([OWASP {ID}]({exact URL from reference table}))

**Regulatory References:**
- **GDPR:** [Art. {N} — {Topic}]({exact URL from reference table})
- **Swiss FADP:** [Art. {N} — {Topic}]({exact URL from reference table})
- **CCPA:** [§1798.{N} — {Topic}]({exact URL from reference table})

*(Include only the regulations that apply. Omit this block entirely for pure security findings with no privacy/data-protection angle.)*

**Description:** [What is the issue]
**Evidence:** [URL tested, HTTP response, proof]
**Impact:** [What could go wrong]
**Remediation:** [How to fix with code examples]

---

*(Repeat the same structure for each finding within each severity level)*

**IMPORTANT — inline linking rule:** Every mention of an OWASP category, GDPR article, Swiss FADP article, CCPA section, or ePrivacy article anywhere in the report text MUST be a clickable markdown link using the exact URLs from the Regulatory Reference Links table. Examples:
- Write `[OWASP A05:2021](https://owasp.org/Top10/A05_2021-Security_Misconfiguration/)` — never plain text `OWASP A05:2021`
- Write `[GDPR Art. 32](https://gdpr-info.eu/art-32-gdpr/)` — never plain text `Art. 32`
- Write `[Swiss FADP Art. 8](https://www.fedlex.admin.ch/eli/cc/2022/491/en#art_8)` — never plain text `FADP Art. 8`
- Write `[CCPA §1798.150](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?sectionNum=1798.150.&lawCode=CIV)` — never plain text `§1798.150`

This applies in the Category line, Regulatory References block, Description, Impact, Remediation — everywhere in the report without exception.

### HIGH
[Same structure as CRITICAL]

### MEDIUM
[Same structure as CRITICAL]

### LOW
[Same structure as CRITICAL]

### INFORMATIONAL
[Positive controls and neutral observations]

---

## Positive Security Controls

| Control | Status |
|---------|--------|
| ... | ... |

---

## Regulatory Compliance Issues (if not skipped)

Only include rows for regulations where an actual issue was found. Do NOT list compliant requirements. Use the exact URLs from the Regulatory Reference Links table above.

| Finding ID | Issue | OWASP | GDPR | Swiss FADP | CCPA | ePrivacy |
|------------|-------|-------|------|------------|------|----------|

Each cell should contain a clickable markdown link to the specific article, or `—` if that regulation does not apply to the finding. Example row:

| C-1 | PII documents publicly accessible | [A01:2021](https://owasp.org/Top10/A01_2021-Broken_Access_Control/) | [Art. 32](https://gdpr-info.eu/art-32-gdpr/), [Art. 33](https://gdpr-info.eu/art-33-gdpr/) | [Art. 8](https://www.fedlex.admin.ch/eli/cc/2022/491/en#art_8), [Art. 24](https://www.fedlex.admin.ch/eli/cc/2022/491/en#art_24) | [§1798.150](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?sectionNum=1798.150.&lawCode=CIV) | — |

---

## Recommended Priority Actions

### Immediate (24-48 hours)
1. [Critical fixes]

### Short-term (1-2 weeks)
2. [High-priority fixes]

### Medium-term (1-3 months)
3. [Medium and improvement items]

---

## Appendix: URLs Tested

| URL | Response | Finding |
|-----|----------|---------|
| ... | ... | ... |

---

*This assessment was performed at the request of the invoking operator, who attests authorization to test {domain} (or as named in the Authorization line above). All testing was non-destructive and limited to read-only requests (HTTP GET/HEAD/OPTIONS and passive DNS lookups). {if --active: "Active-tier open-redirect checks sent crafted query parameters using the reserved example.com canary; redirects were inspected, never followed off-site."} No exploitation, credential testing, or destructive actions were performed.*

*Report generated: {YYYY-MM-DD}*
```

## Step 5: Convert to PDF

After writing the Markdown report, convert it to PDF. Both files go to the report directory (`--out` or CWD). Method 1 takes the full `{md_report_path}` so it works regardless of `--out`. The Docker fallbacks mount `$(pwd)` — if `--out` is a different directory, treat that directory as the working directory for the `docker run` (mount it instead of `$(pwd)`). Try these methods in order until one succeeds:

**Method 1 — npx md-to-pdf (preferred, Node.js is installed locally):**
```bash
npx --yes md-to-pdf "{md_report_path}" 2>/dev/null
```
This creates the PDF alongside the MD file automatically. (PDF is `md-to-pdf`'s default output — do **not** pass `--as-html false`: `--as-html` is a boolean flag, so `false` is misparsed as an input filename rather than consumed as the flag's value.)

**Method 2 — Docker pandoc (fallback):**
```bash
docker run --rm -v "$(cygpath -w "$(pwd)"):/data" -w //data pandoc/extra:latest \
  "{md_filename}" -o "{pdf_filename}" \
  --pdf-engine=xelatex \
  -V geometry:margin=2cm \
  -V fontsize=11pt \
  -V colorlinks=true \
  -V linkcolor=blue \
  --highlight-style=tango 2>/dev/null
```

**Method 3 — Docker markdown-pdf (second fallback):**
```bash
docker run --rm -v "$(cygpath -w "$(pwd)"):/data" -w //data node:20-alpine \
  sh -c "npx --yes md-to-pdf /data/{md_filename}" 2>/dev/null
```

**If all methods fail:** Inform the user that the MD report was generated successfully but PDF conversion failed. Suggest they install `md-to-pdf` globally (`npm i -g md-to-pdf`) for future runs. Do NOT let PDF failure block the overall assessment.

## Step 6: Present Results

After generating both report files, present to the user:
1. The report file paths (MD and PDF)
2. The executive summary
3. Count of findings by severity
4. Top 3 most critical findings with one-line descriptions
5. Top 3 recommended immediate actions

---

## Rules

- **MANDATORY URL**: If no URL argument is provided, refuse to proceed. Do not guess or assume a URL.
- **Fully autonomous**: Do not ask the user for confirmation at any step. Execute the full assessment pipeline and deliver results.
- **Non-destructive only**: `GET`, `HEAD`, and the safe read-only `OPTIONS` preflight only. Never `POST`, `PUT`, `PATCH`, `DELETE`, or attempt any modification. Passive DNS-over-HTTPS lookups (Module U6) are read-only and allowed.
- **Active tier is gated**: Module A1 (open-redirect) sends crafted query parameters and runs **only** when `--active` is passed. It stays `GET`/`HEAD`-only and never follows a redirect off-site (inspects `Location` only). Use the reserved `example.com` canary — never a real third-party domain. Without `--active`, never send crafted-payload requests.
- **No credential testing**: Never attempt login, brute force, or authentication bypass.
- **No document or binary downloads**: Probe path existence with `HEAD`; `GET` is permitted only to read small text resources (HTML/JSON/txt) for analysis. Never download or save document files, database dumps, archives, or binaries.
- **Parallel execution**: Maximize parallel tool calls for efficiency. Run independent checks simultaneously.
- **Evidence-based**: Every finding must include the specific URL tested and the HTTP response that confirms it.
- **Technology-adaptive**: The assessment plan MUST be adapted based on the detected technology stack. Do not run WordPress checks on a Django site.
- **GDPR scope**: Assess based on apparent jurisdiction (company location, target audience, TLD). Note which regulations likely apply.
- **No false positives**: Only report findings you can confirm via HTTP response. A 404 is not a finding. A 200 on a sensitive path IS a finding. A `301`/`302` to the homepage or login page is **not** a finding (see Step 0.5). Beware the inverse — a **false negative**: if you probe the wrong (pre-redirect) host, everything returns 301 and the audit looks clean. Always probe the canonical host from Step 0.5.
- **Inconclusive ≠ clean**: For checks that genuinely cannot be confirmed without JavaScript execution (JS-injected cookie banners — Module U5) or arbitrary configuration (DKIM selectors — Module U6), report the result as **INCONCLUSIVE** with the reason, never as a confirmed pass or a confirmed violation.
- **Report completeness**: The report must include ALL checks performed and their results, including negative results in the appendix.
- **Copyright compliance**: Never reproduce more than 15 words from any page content. Summarize findings in your own words.
