# Lesson 09 — Email authentication (SPF/DKIM/DMARC) on a Vercel-DNS + ImprovMX domain

**Date:** 2026-06-14
**Severity:** P1 for deliverability (outreach mail is the site's primary growth lever; mail in spam = no backlinks)
**Context:** setting up `martin@electrifycost.com` (ImprovMX forwarding + Gmail "send as") and hardening it so outreach mail reaches inboxes and the domain can't be spoofed.

The full current record values live in `INFRASTRUCTURE.md`. This lesson captures the **non-obvious gotchas** hit during setup so they don't bite again on the next portfolio domain.

## The setup, in one line

DNS is on Vercel; mail is ImprovMX (forward in, Gmail "send as" relays out via `smtp.improvmx.com:587`). Three DNS records make it trustworthy: SPF (had it), DKIM (added), DMARC (added). Verified 10/10 on mail-tester.com.

## Gotcha 1 — SPF alone is NOT enough when mail is relayed

The domain already had `v=spf1 include:spf.improvmx.com ~all`. That is necessary but not sufficient: when Gmail relays your mail through ImprovMX, SPF can technically **pass** on a domain that does **not align** with the visible `From:` (`electrifycost.com`), and DMARC then sees no aligned pass. **DKIM is the fix** — it signs as `d=electrifycost.com`, giving an aligned pass regardless of the relay path. Lesson: for any send-as/relay/forwarding setup, SPF + DKIM + DMARC together, not SPF alone.

## Gotcha 2 — DKIM is only needed if you SEND via the provider's SMTP

ImprovMX's own guide states DKIM "is needed only for SMTP sending." A receive-only forwarder doesn't need it. We needed it because Gmail "Send mail as" relays outbound through `smtp.improvmx.com` (confirmed in Gmail → Accounts and Import → "Mail is sent through: smtp.improvmx.com"). DKIM = two CNAMEs (`dkimprovmx1._domainkey`, `dkimprovmx2._domainkey` → `dkimprovmx{1,2}.improvmx.com`), which chain to a published `v=DKIM1` key.

## Gotcha 3 — Vercel's "Wildcard Domain Override" warning on `_domainkey` is safe

Adding `dkimprovmx1._domainkey` in Vercel pops a scary **"Wildcard Domain Override … will disable wildcard matching for `*._domainkey.electrifycost.com`"** dialog. It is safe to Confirm:
- `_domainkey` names are used for **one thing only — DKIM**. The override can't touch the website, MX, SPF, or DMARC.
- A live-DNS check (`nslookup` a random `*._domainkey` selector) showed **no wildcard actually answering** — the warning is precautionary.
- Both real selectors are being created explicitly, so DKIM resolves regardless.

## Gotcha 4 — Do NOT test auth by sending Gmail → the same Gmail

The biggest time-sink. Sending from your Gmail to **the same** Gmail account makes Google deliver it **internally** and skip inbound authentication entirely. Gmail's "Show original" then shows **no SPF/DKIM/DMARC rows** and the raw headers have no `DKIM-Signature` / `Authentication-Results` — which looks like a failure but is a **non-test**. Tells: "Delivered after 0 seconds", `@mail.gmail.com` Message-ID, minimal headers.

**Valid tests** force a clean external receipt:
- [mail-tester.com](https://www.mail-tester.com) — send as the address to its unique mailbox, get a 0–10 score + SPF/DKIM/DMARC breakdown (we got 10/10).
- `check-auth@verifier.port25.com` — auto-replies with a pass/fail report.
- Any **non-Gmail** mailbox you control, then "Show original" there.

## Gotcha 5 — Start DMARC at `p=none`, tighten later

Publish `v=DMARC1; p=none; rua=mailto:...; fo=1` first (monitor only — never risks your own mail). After ~3 weeks of clean aggregate reports, tighten `p=none` → `p=quarantine` → eventually `p=reject`. The protection ramps with the policy; `p=none` already helps deliverability by signaling the domain does auth properly.

## Reusable checklist for the next portfolio domain (ImprovMX + Vercel DNS)

1. Confirm MX → `mx1/mx2.improvmx.com` and SPF `include:spf.improvmx.com`.
2. If sending via Gmail "send as" (relay): add the two ImprovMX DKIM CNAMEs (Confirm the wildcard warning).
3. Add DMARC TXT at `_dmarc`, `p=none`, `rua` to the domain's own address.
4. Verify with mail-tester.com (NOT a self-addressed Gmail). Want 10/10 + "properly authenticated".
5. Calendar the `p=none → p=quarantine` tightening ~3 weeks out.

Names go in the **host** field only (Vercel appends the domain); no quotes; no trailing dot on CNAME values — same as `INFRASTRUCTURE.md` shows.
