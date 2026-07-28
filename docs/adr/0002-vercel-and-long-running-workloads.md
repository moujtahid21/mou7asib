# ADR 0002 — Where the queue, workers and documents live

- **Status:** Proposed — awaiting decision by the project owner
- **Date:** 2026-07-27
- **Resolves:** CLAUDE.md §16 decision 2
- **Depends on:** ADR 0001 accepted (custom stack). If ADR 0001 is rejected, this ADR is moot.
- **Blocked on a legal input:** the data-residency question below is a CNDP question, not
  an engineering one, and it constrains the answer more than any technical factor.

---

## Context

PROJECT_BRIEF.md §1 requires deployment on Vercel. CLAUDE.md §3 requires that OCR, LLM
extraction, batch imports, report generation and bank sync run as queued background jobs,
because none of them fit in a serverless request.

Rough shape of the work that does not fit:

| Job | Realistic duration | Fits a serverless function? |
|---|---|---|
| Virus scan on upload | 1–5 s | marginal |
| PDF text-layer extraction | 1–3 s | yes |
| OCR of a phone photo | 5–30 s | no |
| LLM structured extraction | 3–20 s, plus retries | no |
| Multi-page scanned PDF | 30 s – several min | no |
| Batch import (CSV of 5 000 rows) | minutes | no |
| État de synthèse generation | seconds to a minute | marginal |
| Bank statement sync | seconds, but scheduled | no (needs a scheduler) |

Two further constraints that are easy to miss:

- **Warm state.** OCR models, PDF rasterisers and virus-scanner signature databases want
  a warm, long-lived process. Paying cold-start plus model-load per document is both slow
  and expensive — directly against the price point (ADR 0005).
- **Sandboxing.** CLAUDE.md §8.4 requires parsing untrusted PDFs and spreadsheets in a
  sandboxed process with memory/CPU limits and **no network access**. That is a container
  primitive. It is not something a managed serverless function gives you.

So this is not "Vercel vs. not Vercel". It is: **the web tier and the document tier have
different requirements, and the brief only committed the web tier to Vercel.**

## The question that must be answered first

**Is data residency in Morocco (or an explicit CNDP cross-border transfer authorisation)
a requirement?**

CLAUDE.md §8.6 is explicit that processing personal data outside Morocco is a CNDP
transfer question. This changes the option set completely:

- If **residency in Morocco is required**: Vercel, and every major managed AI provider,
  are off the table for document contents. The realistic path is a Moroccan or
  Morocco-adjacent host plus self-hosted OCR and possibly a self-hosted model. That is a
  different, much more expensive product.
- If **cross-border transfer under CNDP authorisation is acceptable**: the full option set
  below applies, and the compliance work is paperwork plus a documented sub-processor list.

`TODO(legal)` — see `docs/legal-inputs.md`, rows L-30 to L-33. **Do not design the
ingestion tier before this is answered.** Everything below assumes cross-border transfer
under authorisation is acceptable; if it is not, only Option D survives.

## Options

### Option A — Everything on Vercel (functions + Vercel Queues/Cron)

**For** — one platform, one bill, one deploy, matches the brief literally.

**Against** — function execution limits do not accommodate multi-page OCR; no warm model
state; no network-isolated sandbox for untrusted file parsing; per-invocation pricing on
CPU-bound OCR work is the worst possible cost shape for this workload. Verify current
Vercel function duration and memory ceilings against the plan before treating any number
here as fixed — but the sandbox and warm-state objections hold regardless of the limits.

**Verdict:** does not satisfy CLAUDE.md §3 or §8.4. Rejected on requirements, not on taste.

### Option B — Vercel for web/BFF + a container host for `apps/ai` and the worker

Next.js stays on Vercel. A separate always-on service (Fly.io, Railway, Render, Hetzner,
AWS ECS/Fargate, Scaleway) runs the FastAPI service, the queue worker and the sandboxed
parsers. Queue is Postgres-backed or Redis-backed. Object storage is S3-compatible (S3,
R2, Scaleway, Backblaze).

**For**
- Honours the brief's Vercel requirement for the part of the system it was written about.
- Warm processes, real containers, real sandboxing, predictable CPU pricing.
- The web tier's DX (preview deploys, edge caching) is genuinely good and worth keeping.
- The `apps/web` ↔ `apps/ai` boundary already exists in CLAUDE.md §3; this deployment
  shape *is* that boundary.

**Against**
- Two platforms, two deploy pipelines, two sets of secrets, two on-call surfaces.
- Cross-platform latency and egress between Vercel and the container host.
- Database connection topology needs thought (both tiers talk to Postgres).

### Option C — Everything on one container platform; drop Vercel

Next.js runs in a container next to the Python service.

**For** — one platform, co-located, simplest network and secret model, easiest to move to
a Moroccan host later, no egress between tiers.

**Against** — loses Vercel's preview deploys and edge network; someone must own Next.js
build/runtime configuration in a container (well-trodden, but it is work); contradicts an
explicit line in the brief.

### Option D — Morocco-resident hosting, self-hosted OCR and model

Everything in a Moroccan datacentre or on Moroccan-controlled infrastructure. Self-hosted
OCR (e.g. a local OCR engine) and a self-hosted or in-country model endpoint.

**For** — removes the CNDP transfer question entirely; a genuine differentiator in a market
where "your books leave the country" is a real objection from accountants.

**Against** — self-hosted extraction quality on phone photos of Moroccan invoices is
materially worse than frontier hosted models today; GPU cost per tenant is hard to
reconcile with 100–200 MAD/month; far more operational work. This is a strategic bet, not
a default.

## Trade-off summary

| | A: all Vercel | B: split | C: all container | D: Morocco-resident |
|---|---|---|---|---|
| Meets CLAUDE.md §3 (queued jobs) | ❌ | ✅ | ✅ | ✅ |
| Meets CLAUDE.md §8.4 (sandbox, no net) | ❌ | ✅ | ✅ | ✅ |
| Honours brief's "Vercel" line | ✅ | ✅ (web tier) | ❌ | ❌ |
| Warm OCR/model state | ❌ | ✅ | ✅ | ✅ |
| Ops surface | 1 platform | 2 platforms | 1 platform | 1, but heavy |
| Cost shape for CPU-bound OCR | worst | good | good | capex-like |
| Survives a "Morocco residency" ruling | ❌ | ❌ | partially | ✅ |

## Recommendation

**Option B**, with a deliberate constraint that makes Option C or D cheap to reach later:

1. `apps/web` on Vercel — UI, BFF route handlers, auth, enqueue-and-poll only.
2. `apps/ai` + queue worker + sandboxed parsers on **one** container host, chosen for
   proximity to the database and for a European or Moroccan region.
3. Postgres from a managed provider in the **same region** as the worker, not near Vercel.
   The ledger is the latency-sensitive thing; the web tier can tolerate the hop.
4. Object storage S3-compatible, private ACLs, short-lived signed URLs (CLAUDE.md §8.4).
5. **Queue on Postgres first** (e.g. a `jobs` table with `SELECT … FOR UPDATE SKIP LOCKED`),
   not Redis, not a managed queue product. One less service, one less bill, transactional
   with the ledger, and entirely sufficient at the volumes of a first year. Add a dedicated
   broker when queue depth actually demands it, not before.
6. **Constraint that buys the escape hatch:** `apps/web` must not use any Vercel-only
   primitive beyond build and deploy. No Vercel KV, no Vercel Blob, no edge middleware
   holding logic. If that holds, moving to Option C is a Dockerfile and a DNS change.

Point 6 is the real content of this recommendation. It costs almost nothing now and is
what makes a later residency ruling survivable.

> **Update 2026-07-27 (decision log D-02, D-03).** Vercel is provisional — the owner's words
> are "deployed on Vercel to test it first". That changes the emphasis of this ADR without
> changing its recommendation:
>
> - **Point 6 is no longer insurance, it is the design.** Option C is now the *expected*
>   destination rather than a contingency. Treat any Vercel-only primitive that creeps in as
>   a defect, not a trade-off.
> - **With a team of two (D-03), the two-platform ops burden is a live cost.** The split is
>   still recommended, because CLAUDE.md §8.4's sandboxing requirement is not negotiable and
>   serverless cannot satisfy it — but the case for moving to Option C early is stronger
>   than this ADR argued when written. Concretely: if S0 or S5 reveals meaningful friction
>   in running two platforms, go to Option C rather than absorbing it.
> - The CNDP residency question (L-70) is unchanged and still blocks. It is now the *only*
>   thing that would force Option D.

## What would have to be true for this recommendation to be wrong

1. **CNDP requires data residency in Morocco** for accounting documents containing
   personal data. Then Option B is illegal as designed and Option D is the only route.
   *This is the single highest-impact open question in the project.* Answer it before
   building the ingestion tier.
2. **The two-platform ops burden is unaffordable.** If the team is one person, one
   platform (Option C) may beat a better-fitting split. Judgement call on team size.
3. **Vercel ships something that changes the picture** — long-running background compute
   with genuine container isolation. Re-check current Vercel capabilities before
   implementing; do not rely on this document's snapshot.
4. **Extraction turns out not to need heavy compute.** If the cheap path (PDF text layer)
   covers, say, 80% of real documents and hosted OCR covers the rest via a plain API call
   with no local rasterisation, the "warm state" argument weakens considerably — though the
   §8.4 sandboxing requirement for untrusted PDFs and spreadsheets does not.
5. **Self-hosted extraction quality reaches parity.** Then Option D's main cost argument
   changes and residency becomes cheap to offer as a feature.

## Consequences if accepted

- New infrastructure to provision and name in the PR that introduces it (CLAUDE.md §14):
  a container host, an S3-compatible bucket, a managed Postgres, and a scheduler for
  invariant checks (CLAUDE.md §6) and bank sync.
- New environment variables on both tiers; secrets duplicated across two platforms, which
  means one authoritative secret source and a documented rotation procedure.
- `apps/web` → `apps/ai` calls need service-to-service auth, correlation-ID propagation
  (CLAUDE.md §13), and explicit timeouts.
- A written sub-processor list, maintained from day one (CLAUDE.md §8.6).
