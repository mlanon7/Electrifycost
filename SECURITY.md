# Security Policy

## Reporting a vulnerability

If you discover a security issue with **electrifycost.com** — XSS, data exposure, build-pipeline compromise, supply-chain issue, etc. — please report it via email **before** disclosing publicly:

**Email:** hello@electrifycost.com
**Subject line:** `[SECURITY] <one-line summary>`

Expected response time: **48 hours** for initial acknowledgement, **7 days** for a fix or formal status update.

If the issue is critical (active exploitation, credential exposure, ability to modify served HTML), mark the subject line with `[CRITICAL]` and we'll prioritize same-day response.

---

## Scope

### In scope

- Anything served from **electrifycost.com** or any electrifycost.com subdomain
- The **GitHub repository** at https://github.com/mlanon7/Electrifycost
- The **build pipeline** (Vercel deploy, GitHub Actions CI)
- The **analytics integration** (GA4) — credential or measurement-ID misuse
- The **CSV data files** under `data/csv/` — incorrect data that misleads users is technically a content issue, but if the cause is a tampered commit or compromised dependency it's security

### Out of scope

- Reports on third-party services we link to (IRS, DOE, EnergySage, Mass Save, etc.) — those go to the third party
- Reports on third-party browser extensions interacting with the site
- DoS attacks against Vercel's edge network (Vercel handles that)
- Social-engineering attempts against the maintainer
- Issues requiring physical access to the maintainer's hardware
- Issues in `audit/` historical-context markdown files (those are docs, not running code)

---

## What we'll do

1. Acknowledge receipt within 48 hours.
2. Confirm whether the issue is reproducible and in-scope.
3. If confirmed, work toward a fix or mitigation. We'll keep you updated.
4. Once fixed and deployed, credit the reporter in the relevant `CHANGELOG.md` entry if they want public credit (we'll ask first).

We don't currently run a paid bug-bounty program. Responsible disclosure is appreciated but not financially rewarded yet.

---

## What we won't do

- Block, sue, or threaten researchers acting in good faith
- Ignore reports that are inconvenient
- Patch silently without disclosing the issue in `CHANGELOG.md` once a reasonable embargo period has passed

---

## Security-relevant configuration

For transparency, here's what's already in place:

| Surface | Posture |
|---|---|
| **HTTPS** | Enforced by Vercel; HSTS via Vercel's default headers |
| **Security headers** | `vercel.json` sets `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()` |
| **CSP** | Not currently set; documented as a low-priority TODO. The site has no first-party JS that reads cross-origin data, but a strict CSP would defense-in-depth the cookie-banner inline script + GA4 |
| **Cookies** | Only the GA4-related `_ga` and `_ga_*` cookies; gated by Consent Mode v2 with default `denied` and a user-toggleable banner |
| **PII** | The site captures **no PII**. No accounts, no forms, no email collection. The only "save your inputs" mechanism is a URL hash that lives in the user's clipboard / browser history |
| **Secrets in repo** | None. `.env.example` is placeholder-only; `.env.local` is gitignored |
| **Dependencies** | All npm dependencies are pinned in `package-lock.json`; CI runs on every push to catch supply-chain regressions |
| **Build pipeline** | GitHub Actions → Vercel; both run authenticated builds. No third-party CI |
| **Admin surface** | None. The site is static. There is no admin panel, no API endpoint, no auth |

---

## Past security incidents

None reported as of 2026-05-17.

---

## Subscription / public disclosure

When a security fix ships, it's documented in `CHANGELOG.md` under the "Security" subsection of the relevant release date. There's no separate security advisory feed at this time.
