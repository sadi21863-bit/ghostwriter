# QStash free tier suitability — Vercel Hobby + Cloudflare free

Research pass only, no code changes. Question: is Upstash QStash's free tier
actually workable given this app runs on Vercel's Hobby plan with the
`ghost-writer.cc` domain also on Cloudflare's free plan?

## What QStash is used for here

`src/lib/queue/qstash.ts` wraps two calls: `scheduleCallback()` (a one-time
delayed `publishJSON` to our own API route) and `verifyQstashRequest()`
(signature check on the way back in). Wired into two poll loops so far
(`segmind-video-poll`, `segmind-lipsync-poll`, CLAUDE.md items 37/50): after
the initiating POST route stores a job id, it schedules a callback 15s out;
each callback either finds the job done, or reschedules itself again, up to
`MAX_ATTEMPTS = 40` (~10 minutes total). This is a chain of one-time delayed
publishes, **not** QStash's separate cron-style "Schedule" feature.

## QStash free tier limits (upstash.com/pricing/qstash, confirmed live)

| Limit | Free tier |
|---|---|
| Messages/day | 1,000 |
| Monthly bandwidth | 50 GB |
| Max message size | 1 MB |
| Max delay | 7 days |
| Max HTTP response duration (target endpoint) | 15 minutes |
| DLQ / log retention | 3 days |
| Max active Schedules | 10 |
| Max Queue count | 10 |
| URL Groups | 1 (100 endpoints each) |
| Publish/Enqueue rate limit | none (only management APIs are RPS-limited) |

**The "Max active Schedules: 10" and "Max Queue count: 10" limits do not
apply to our usage.** Confirmed against `upstash.com/docs/qstash/features/delay`
and `.../features/schedules`: a Schedule is specifically the recurring,
cron-based feature (`Upstash-Cron` header) that "we will publish the message
in the given period" indefinitely until deleted. Our `delay` parameter on a
one-off `publishJSON` call is a documented separate mechanism with its own
"Max delay: 7 days" ceiling — nothing in this app creates a Schedule or a
Queue, so those two low caps are non-issues.

**What we actually consume is the 1,000 messages/day budget.** Each delivery
attempt (initial dispatch + every reschedule) is one billed message, with no
free retry allowance. Worst case per job is ~41 messages (1 initial + 40
retries at the 15s cadence hard-coded in both poll routes) if a job runs the
full ~10 minutes before finishing; most real jobs finish well before the cap
and cost far fewer. At 1,000/day that's comfortably dozens of full-length
job-runs per day today, with Pay-as-you-go ($1/100K messages) a cheap escape
hatch if usage ever grows past it.

Message size (our payload is `{userId, projectId/audioExportId, shotId?,
attempt}`, a few hundred bytes) and the 15-minute max target-response-duration
(our poll routes set `maxDuration = 60`) are both non-issues by a wide margin.

## Vercel Hobby plan (confirmed live via vercel.com/docs, 2026-06 docs)

- **Max function duration: 300s, and it is both the default AND the hard
  maximum on Hobby** (Pro/Enterprise can go to 800s/1800s) — matches what
  this codebase's own comments already assumed (`generate-video/route.ts`,
  `lipsync/route.ts`).
- **Invocations: 1,000,000/month** free — the QStash-triggered poll
  invocations (a DB read + one outbound poll HTTP call each, well under a
  second of active CPU) are a rounding error against this.
- **Active CPU: 4 CPU-hours/month, Provisioned memory: 360 GB-hours/month**
  free — same conclusion, negligible added load from polling.
- **Request/response body cap: 4.5 MB** — irrelevant to QStash's tiny JSON
  payloads (this is the same limit already documented in CLAUDE.md for the
  music-upload feature, unrelated to QStash).
- **Runtime logs retained only 1 hour on Hobby** — worth remembering if
  debugging a real QStash webhook failure after the fact; the window is short.

No incoming-request allowlisting or bot-challenge exists on Hobby that would
block a third-party server (Upstash) from POSTing to a public API route —
that's a Cloudflare-specific concern (next section), not a Vercel one.

## Cloudflare free tier — checked empirically, not just from docs

Cloudflare's free/pro/business plans have a **hard, non-configurable 100-second
proxy read timeout** on any traffic actually proxied through Cloudflare's edge
(the orange-cloud setting) — confirmed via Cloudflare's own community/support
docs. That would be a real problem for this app's *synchronous* long-running
routes (`generate-video`'s POST can run up to ~280s per its own code comment,
lipsync can run several minutes) if Cloudflare were sitting in front of them.

**It isn't.** Checked directly:

```
curl -sI https://www.ghost-writer.cc
Server: Vercel
X-Vercel-Id: bom1::iad1::...
```

No `cf-ray`, no `server: cloudflare` — the live domain is served directly by
Vercel with zero Cloudflare proxying in the request path. Cloudflare's role
here is DNS/domain management (and, per CLAUDE.md, email routing for
`support@ghost-writer.cc`) — a grey-cloud / DNS-only setup, not a CDN/WAF
proxy. **The 100s Cloudflare timeout, and any Cloudflare free-tier bot-fight/
WAF challenge that could otherwise block Upstash's server-to-server webhook
POSTs, simply don't apply** — there's nothing to route around.

## Verdict

**QStash's free tier is suitable for this app's current scale, on both
Vercel Hobby and the current Cloudflare (DNS-only) setup.** No plan mismatch,
no hidden proxy timeout, no accidental Schedule/Queue quota consumption. The
one real constraint worth tracking as usage grows is the 1,000 messages/day
cap itself — comfortably headroomed today, cheap to lift with Pay-as-you-go
if it ever isn't.

## One real risk found along the way (not fixed — flagging for a decision)

`scheduleCallback()` (`src/lib/queue/qstash.ts`) has no `try/catch` around the
`publishJSON` call. Every call site (`generate-video`, `audio/lipsync`) calls
it with a bare `await` and no surrounding error handling either. If QStash
ever rejects the call — quota exceeded, a transient Upstash outage, a bad
signing key — that exception would propagate up and turn the whole route's
response into an unhandled 500, **even though the actual generation work
already succeeded and was already saved to the DB** a few lines earlier. That
contradicts the fail-open design the `isQstashConfigured()` gate already
signals (a missing token is a silent no-op; a failing token currently isn't).
Cheap fix if wanted: wrap the `publishJSON` call in try/catch and log-and-swallow,
matching the "QStash is a nice-to-have, not a hard dependency" intent already
established everywhere else in this integration.

## Sources

- [QStash Pricing](https://upstash.com/pricing/qstash)
- [QStash Delay feature](https://upstash.com/docs/qstash/features/delay)
- [QStash Schedules feature](https://upstash.com/docs/qstash/features/schedules)
- [Vercel Functions limits](https://vercel.com/docs/functions/limitations)
- [Vercel account/plan limits](https://vercel.com/docs/limits)
- [Cloudflare free plan 100s proxy timeout (community/support confirmation)](https://community.cloudflare.com/t/has-the-free-plan-100-seconds-timeout-been-changed-to-30-seconds/302374)
