# CRM Reliability Engine

An operational data governance system that sits between external GTM signals (Gong call transcripts, HubSpot activity) and your CRM database. Rather than writing directly to records on ingest, it generates confidence-scored, explainable mutation proposals and routes them through a human review queue before anything changes.

---

## The Problem

CRM data rots fast. Reps forget to update titles after a call. Close dates slip without a stage change. A contact's role shifts but the field stays stale for months. By the time a manager notices, the pipeline report is unreliable and the damage to forecasting is already done.

The standard fix — automated sync — trades one problem for another. Blind writes from integrations introduce their own corruption: overwritten good data, wrong entity matches, confident-but-wrong AI extractions applied without review.

This system takes a different position: **don't write until a human confirms it**. Every suggested change is held in a queue with its source signal, confidence score, and explicit reasoning. Approval is one click. Rejection is one click. Either way, the event is logged.

---

## Architecture

```
External Signals          Ingestion Layer           Review Layer           Data Layer
────────────────         ─────────────────         ─────────────         ───────────
Gong Webhook      ──▶    /api/webhooks/gong   ──▶
                                                    SuggestedMutation     Contact
HubSpot Webhook   ──▶    /api/webhooks/hubspot ──▶  Queue (PENDING)  ──▶  Opportunity
                                                          │
Manual Transcript  ──▶   /api/ingest/transcript           │
                                                    Human Inbox UI
                                                    (Approve / Reject)
                                                          │
                                               ┌──────────┴──────────┐
                                               ▼                     ▼
                                        CRM Record Update      Event Log
                                        (on APPROVED)          (always)


Pipeline Risk Monitor
─────────────────────
/api/pipeline/risk-monitor  ──▶  RulesEngine.evaluateOpportunity()  ──▶  Pipeline Risk Board UI
                            └──▶  SLA_BREACH event when lead untouched > 5 mins
```

## Design Decisions

This project is intentionally structured as a reliability layer, not a direct-sync utility.

**Deterministic routing.** External signals enter through explicit routes (`/api/webhooks/gong`, `/api/webhooks/hubspot`, `/api/ingest/transcript`) and are normalized into the same `SuggestedMutation` shape. Each route has a narrow responsibility: authenticate, validate, extract, enqueue, and log.

**AI constraints.** Extraction is treated as evidence, not authority. Even high-confidence suggestions are stored as proposed JSON changes with reasoning and confidence metadata. The approval route allowlists writable fields per entity, so an extraction layer cannot write arbitrary data even if it produces malformed or unexpected output.

**Replayability.** The system keeps source-derived suggestions and audit events separate from CRM records. That makes it possible to replay or inspect what happened: a webhook created a proposal, a reviewer approved or rejected it, and the final CRM state followed from that decision.

**Event sourcing.** Approvals, rejections, extraction suggestions, and SLA breaches all write to the `Event` table. The event log is the operational memory of the system: it answers what happened, when it happened, and what context was available at the time.

**Human approval layer.** Webhooks create `SuggestedMutation` records, not direct CRM updates. This preserves trust in the CRM by making a human confirm the final write. When approval happens, the CRM update, mutation status change, and audit event are wrapped in one transaction.

**Exceptions queue.** The mutation inbox is the queue for uncertain or high-impact changes. Instead of hiding edge cases in logs, the system surfaces them as reviewable work with enough context for an operator to decide quickly.

**SLA escalation simulation.** The risk monitor also simulates a lightweight operational SLA: if a lead sits untouched for more than five minutes, the system emits an `SLA_BREACH` event and marks the manager as notified. This keeps pipeline governance and data hygiene in the same event-driven model.

---

## Event Flow

### Webhook ingestion (Gong example)

```
POST /api/webhooks/gong
  x-webhook-secret: <GONG_WEBHOOK_SECRET>
  { "contactId": 42 }

1. verifyWebhookSecret() — timing-safe HMAC comparison, 512-byte max
2. Validate contactId is a positive integer
3. Prisma transaction:
   a. Create SuggestedMutation (status: PENDING, entityType: Contact, entityId: 42,
      proposedChange: { title: "VP of Sales" }, confidenceScore: 82.5,
      reasoning: ["Mentioned 'leading sales org'", ...])
   b. Create Event (eventType: EXTRACTION_SUGGESTED, payload: { source: "Gong", mutationId })
4. Return suggested mutation to caller
```

### Human review (approve)

```
POST /api/mutations/review
  { "mutationId": 7, "action": "APPROVED" }

1. Validate mutationId (integer, > 0, no float strings)
2. Validate action is APPROVED or REJECTED
3. Prisma transaction:
   a. Fetch mutation — 404 if not found
   b. Check status === PENDING — 409 if already reviewed
   c. Parse and sanitize proposedChange (allowlist of fields per entityType)
   d. Validate date fields — null and invalid dates are filtered, not coerced
   e. tx.contact.update() or tx.opportunity.update() with sanitized data
   f. tx.suggestedMutation.update({ status: "APPROVED" })
   g. tx.event.create({ eventType: "MUTATION_APPROVED", payload: { mutationId, proposedChange } })
4. Return updated mutation
```

If step (e) throws a Prisma P2025 (record not found), the entire transaction rolls back. The mutation status stays PENDING.

---

## Human-in-the-Loop Design

The review inbox exists because the cost of a wrong write is asymmetric. A missed update is recoverable — a rep can fix it in 30 seconds. A wrong update that gets baked into a report, replicated to a downstream system, or used to trigger an automation is harder to undo and harder to trace.

The inbox enforces four properties:

- **Explainability before action** — every suggestion shows the signals that generated it alongside its confidence score. A reviewer isn't approving a black-box write; they're confirming a specific claim with stated evidence.
- **Idempotent review** — a mutation can only move from `PENDING` once. Concurrent approvals return a 409, not a double-write.
- **Field allowlisting** — even an approved mutation only writes fields in the declared safe set (`CONTACT_FIELDS`, `OPPORTUNITY_FIELDS`). A compromised or buggy extraction can't inject arbitrary columns.
- **Complete audit trail** — rejection is a first-class outcome, logged the same way as approval. "Why is this field X?" is answerable from the event log.

---

## Rules Engine

The pipeline risk monitor uses a configurable rules engine rather than hardcoded thresholds. Policies are declared as condition/action pairs and evaluated against opportunity records.

```js
const policies = [
  {
    condition: {
      minAmount: 50000,      // only evaluate deals above this value
      inactivityDays: 10,    // flag if no activity in N days
      pastCloseDate: true,   // flag if close date has passed
    },
    action: {
      escalateRisk: 5.0,
      reasoningLabel: "Enterprise deal with no activity and past close date",
    },
  },
];

const engine = new RulesEngine(policies);
const result = engine.evaluateOpportunity(opportunity);
// { newRiskScore: 5.0, reasons: [...], isEscalated: true }
```

Each condition is evaluated independently. An opportunity only triggers a rule if it satisfies all conditions simultaneously. Multiple rules can match, and their `escalateRisk` values accumulate. The `isEscalated` flag fires at a score of 7.0 or above.

Adding a new policy requires no changes to the engine — just add an object to the array.

---

## Observability

Every significant action writes to the `Event` table:

| `eventType`             | Trigger                                      |
|-------------------------|----------------------------------------------|
| `EXTRACTION_SUGGESTED`  | Webhook ingestion creates a mutation proposal |
| `MUTATION_APPROVED`     | Human approves — CRM record updated          |
| `MUTATION_REJECTED`     | Human rejects — no CRM change                |
| `SLA_BREACH`            | Lead sits untouched beyond the SLA window    |

Events store a JSON `payload` with the full context (mutation ID, proposed change, source). The audit log UI surfaces the 20 most recent events; the `/api/events` endpoint is available for deeper queries.

---

## Data Model

```prisma
model SuggestedMutation {
  id              Int            // primary key
  entityType      EntityType     // Contact | Opportunity
  entityId        Int            // FK to the target record
  proposedChange  String         // JSON — the fields to write on approval
  confidenceScore Float          // 0–100, from extraction layer
  reasoning       String         // JSON array of human-readable evidence strings
  status          MutationStatus // PENDING | APPROVED | REJECTED
  createdAt       DateTime
}

model Event {
  id         Int        // primary key
  entityType EntityType
  entityId   Int
  eventType  String
  payload    String     // JSON — full context snapshot at time of event
  timestamp  DateTime
}
```

`Contact` and `Opportunity` are standard CRM records. Mutations reference them by `entityId` but maintain no foreign key constraint — the approval transaction handles missing records gracefully.

---

## API Reference

| Method | Endpoint                          | Auth                   | Description                          |
|--------|-----------------------------------|------------------------|--------------------------------------|
| `POST` | `/api/webhooks/gong`              | `x-webhook-secret`     | Ingest Gong transcript, create mutation |
| `POST` | `/api/webhooks/hubspot`           | `x-webhook-secret`     | Ingest HubSpot activity, create mutation |
| `POST` | `/api/ingest/transcript`          | `x-webhook-secret`     | Manual transcript submission         |
| `GET`  | `/api/mutations/review`           | —                      | Fetch all PENDING mutations (max 50) |
| `POST` | `/api/mutations/review`           | —                      | Approve or reject a mutation         |
| `GET`  | `/api/pipeline/risk-monitor`      | —                      | Run rules engine against opportunities |
| `GET`  | `/api/events`                     | —                      | Fetch recent audit events (max 20)   |

All authenticated endpoints use timing-safe HMAC comparison against the configured secret. Oversized secrets (> 512 bytes) are rejected before comparison to prevent memory exhaustion.

---

## Quickstart

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env

# 3. Initialize database and seed
npx prisma db push
npx prisma generate
npx prisma db seed

# 4. Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

To test a webhook locally:
```bash
curl -X POST http://localhost:3000/api/webhooks/gong \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: your-local-secret" \
  -d '{ "contactId": 1 }'
```

---

## Tech Stack

| Layer       | Choice                         |
|-------------|--------------------------------|
| Framework   | Next.js 14 (App Router)        |
| ORM         | Prisma 5                       |
| Database    | SQLite (local) / swappable     |
| Styling     | Tailwind CSS                   |
| Auth        | Shared secret, timing-safe     |

---

## Future Extensions

The architecture has deliberate extension points without requiring a rewrite:

- **Real AI extraction** — the ingestion routes have a stubbed extraction step. Swap in an LLM call; the mutation queue and review flow don't change.
- **Confidence thresholds** — auto-approve high-confidence mutations (e.g., > 95%) by adding a policy check before the queue write. Auto-reject below a floor.
- **Webhook signature verification** — the `verifyWebhookSecret` utility is the only thing to replace with HMAC-SHA256 payload signing once connected to real Gong/HubSpot endpoints.
- **Persistent risk scoring** — the rules engine currently evaluates on demand. Writing scores back to `Opportunity.riskScore` on a schedule turns the risk board into a persistent state view.
- **Multi-source deduplication** — when both Gong and HubSpot suggest the same field change for the same entity, a dedup pass before queue insertion would collapse them into a single review item.

---

## Note on Secrets

No real API keys are required. All secrets are local values set in `.env`. Nothing is committed to this repository.
