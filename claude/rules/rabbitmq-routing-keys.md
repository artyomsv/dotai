---
description: RabbitMQ exchange names, queue names, and routing-key naming convention. Loaded when adding or refactoring any RabbitMQ wiring, declaring new queues/exchanges/bindings, or reviewing message-flow code.
paths:
  - "**/RabbitMQConfiguration.java"
  - "**/messaging/**/*Configuration.java"
  - "**/messaging/**/*Consumer.java"
  - "**/messaging/**/*Publisher.java"
  - "**/messaging/**/*Producer.java"
  - "**/messaging-common/**"
---

# RabbitMQ — Exchange, Queue, and Routing-Key Naming

This rule defines how new RabbitMQ topology is named across the monorepo. **Legacy names that pre-date this rule are left as-is** — only new wiring follows this convention.

## Why this rule exists

Previous wiring used inconsistent prefixes (`testmeai.*`, raw event names, mixed dot-namespaces) which made it impossible to tell at a glance which service owns a routing key, whether a key is meant for cross-service consumption or internal pipeline plumbing, and which exchange a key lives on. Mismatches between publisher and consumer routing keys silently dropped messages with no broker error.

## Generic Event Topics — A service's topic is a firehose of facts

Before any of the detailed naming rules below, internalise the highest-order principle: **a service's topic exchange publishes facts about that service's domain, and the producer is consumer-blind.** Get this wrong and the naming rules cannot save you — you'll end up with `*-requested` keys on the wrong exchange, queues named for the producer instead of the worker, and publishers reaching into someone else's topic.

### Context

The first instinct when wiring a cross-service flow is to name a routing key after the work the downstream consumer will do (`ai.answer-feedback-requested`, `*-needed`, `*-required`). That's command-style — the producer is encoding the action and the downstream is bolted into the producer's vocabulary. The opposite is correct: the producer broadcasts what just happened **in its own domain**, never names the consumer, and the consumer decides which facts it cares about by declaring its own queue and bindings.

### The principle

1. **Events are facts.** Past-tense verbs describe what happened in the owning service's domain. `interviews.answer-submitted`, `ai.answer-feedback-generated`, `payments.charge-captured`. Never `*-requested`, `*-required`, `*-needed` — those imply a target and bake consumer knowledge into the producer's contract.
2. **A service publishes ONLY to its own topic exchange.** Cross-service flow is always: producer → producer's own topic → consumer's queue (bound by the consumer to the producer's topic). A service never reaches into another service's exchange to publish a message.
3. **A consumer owns its queue and its bindings.** The queue name describes the worker (`ai.score-answer`, `interviews.feedback-fanin`), not the event consumed. Bindings live in the consumer's `RabbitMQConfiguration`. The consumer is free to bind to multiple producers' topics; the producers don't know.
4. **The producer is consumer-blind.** Producer code never names a downstream consumer in routing keys, queue names, or class names. If you can't change consumers without changing producer code (beyond the event payload contract), the boundary is wrong.
5. **No application prefix anywhere.** Exchange names, queue names, routing-key segments — never include `testmeai`, `fairy-book`, `linguo-chat`, `hiveos`, or any other application name. The application is a deployment concern, not a contract concern; the same service may be packaged into multiple apps and its topology must not encode that choice. Use the bare service name (`ai`, `interviews`, `payments`) and nothing else. Existing legacy names with app prefixes are listed in the "Legacy / pre-rule names" section and are exceptions, not precedents.

### Public vs internal — the topic-filter convention

A producer's topic is structured so a consumer can subscribe by topic filter and get exactly the right slice with one binding. Recall RabbitMQ topic semantics: `*` matches one word (one dot-segment), `#` matches zero or more words.

| Topic filter | Audience | What it matches |
|---|---|---|
| `<service>.*` | Any sibling service wanting all public facts | `<service>.event` — single-event keys with no `.internal.` segment |
| `<service>.internal.#` | Only the service itself (or its dedicated worker) | Every internal pipeline plumbing key |
| `<service>.<specific-event>` | A specific consumer | One narrow event |
| `<service>.#` | Use sparingly | Literally everything — public AND internal. `#` is greedy and crosses the `.internal.` boundary, so prefer `<service>.*` unless you genuinely need the internal stream too. |

So routing keys split into two camps, with no third option:

- **Public, cross-service:** `<service>.<event>` — no `.internal.` segment. Treated as part of the service's published contract; subject to the deprecation protocol on change. A sibling subscribes with `<service>.*` and gets the full public feed.
- **Internal-only, single-consumer:** `<service>.internal.<step>` — the `.internal.` segment is the explicit marker. Can be renamed or restructured freely without external consumer coordination because external bindings on `<service>.*` cannot see internal keys.

The `.internal.` segment is therefore a load-bearing convention: it is what makes "external subscribers using `<service>.*` are isolated from refactors" actually true. Never put internal plumbing under a public-looking key, and never reach for `<service>.#` when `<service>.*` does the job.

`<service>.internal.<step>` is unchanged — that pattern still applies to internal pipeline plumbing where the producer and the consumer are the **same** service. The principles above are specifically for cross-service flow.

### Examples — wrong vs right

The current/legacy shape that violates the principle, and what it should become:

| Wrong (command-style, consumer-coupled) | Right (fact-style, consumer-blind) |
|---|---|
| interviews-svc publishes `ai.answer-feedback-requested` onto `testmeai.ai` (someone else's exchange, RK names the downstream action) | interviews-svc publishes `interviews.answer-submitted` onto its own `testmeai.interviews` (RK is a fact about interviews-svc's domain) |
| ai-svc publishes `interviews.answer-feedback-generated` onto `testmeai.interviews` | ai-svc publishes `ai.answer-feedback-generated` onto its own `testmeai.ai` |
| Queue `ai.answer-feedback-requested` (named after the inbound event) | Queue `ai.score-answer` (named after the worker that consumes it) |
| Class `AnswerFeedbackConsumer` (named after the inbound event) | Class `AnswerScoringWorker` (named after the work it performs) |
| Event class `AnswerFeedbackRequestedEvent` (verb tense implies target) | Event class `AnswerSubmittedEvent` (past tense, fact about the submission) |

The rename trail is the easiest sanity check: if your class names, queue names, or routing keys carry the word **requested**, **required**, **needed**, **to-be-X**, you're describing the consumer's intent — re-anchor on the producer's fact.

## The rules

### 1. Service prefix on every routing key

Every routing key on a service-owned topic exchange MUST start with the **owning service's bare name**:

```
<service>.<event-or-step>
```

The "owning service" is the service that **declares the topic exchange** — usually the one whose domain the events describe, regardless of which service emits a particular message. Example: routing keys on the topic owned by `interviews-svc` all start with `interviews.`, even if `ai-svc` is the publisher.

| ✅ Good | ❌ Bad |
|---|---|
| `interviews.completed` | `interview.completed` (no service prefix) |
| `interviews.feedback-ready` | `feedback.ready` |
| `ai.answer-feedback-requested` | `answer.feedback-requested` |
| `recruitment.invitation-revoked` | `invitation.revoked` |

### 2. Internal vs cross-service: explicit `.internal.` segment

A routing key consumed by **one and only one service** (typically the same service that owns the exchange, or a single dedicated worker) MUST include `.internal.` as the second segment:

```
<service>.internal.<step>
```

A routing key intended for **cross-service consumption** has NO `.internal.` segment — it is treated as part of the service's public contract.

| Audience | Pattern | Example |
|---|---|---|
| Cross-service public event | `<service>.<event>` | `interviews.completed`, `interviews.feedback-ready` |
| Single-consumer internal step | `<service>.internal.<step>` | `ai.internal.answer-feedback-requested`, `interviews.internal.answer-feedback-generated` |

The distinction matters at refactor time: `.internal.` keys can be renamed or restructured freely without breaking external consumers. Non-`.internal.` keys are contracts — changes follow the deprecation protocol in `api-versioning-and-contracts.md`.

### 3. No application name in exchange, queue, or routing-key names

**Never** include an application (`testmeai`, `fairy-book`, `linguo-chat`, `hiveos`) prefix in any new exchange, queue, or routing-key name. Use only the service name. The application is a deployment concern, not a contract concern; services own their topology and should be deployable into any app.

| ✅ Good | ❌ Bad |
|---|---|
| Exchange `ai.feedback.retry` | `testmeai.ai.feedback.retry` |
| Queue `interviews.answer-feedback-generated` | `testmeai.interviews.answer-feedback-generated` |
| Routing key `ai.internal.answer-feedback-requested` | `testmeai.ai.answer-feedback-requested` |

### 4. Exchange names

A service may own multiple topic exchanges. Naming pattern:

```
<service>                            # main events topic owned by the service
<service>.<purpose>                  # secondary topic for a specific concern
<service>.<purpose>.retry            # retry direct / fanout exchange
<service>.<purpose>.dlq              # dead-letter direct exchange
```

Examples (new topology only):

- `ai` — AI service main exchange
- `ai.feedback.retry` — fanout retry for the AI feedback pipeline
- `ai.feedback.dlq` — DLQ for the AI feedback pipeline
- `interviews` — interviews service main exchange
- `interviews.answer-feedback.retry` — per-answer retry chain
- `interviews.answer-feedback.dlq` — per-answer DLQ

### 5. Queue names

Queues belong to whichever service consumes them. Naming:

```
<service>.<purpose>                  # main consumer queue
<service>.<purpose>.retry.queue      # retry parking queue (per-message TTL)
<service>.<purpose>.dlq.queue        # dead-letter parking queue (no consumer)
```

Examples:

- `ai.answer-feedback-requested`
- `ai.interview-feedback-requested`
- `ai.feedback.retry.queue`
- `ai.feedback.dlq.queue`
- `interviews.answer-feedback-generated`
- `interviews.answer-feedback.retry.queue`
- `interviews.answer-feedback.dlq.queue`

### 6. Routing-key dot-namespacing

Use dots to subdivide:

```
<service>.<event>                                # cross-service event
<service>.internal.<step>                        # single-consumer internal step
<service>.<event>.<modifier>                     # variant (e.g. retried)
<service>.internal.<step>.<modifier>             # internal variant
```

Examples:

- `interviews.feedback-ready` — public event
- `interviews.internal.answer-feedback-generated` — internal worker result
- `interviews.internal.answer-feedback-generated.retried` — same key after retry-queue TTL bounce
- `ai.internal.answer-feedback-requested` — per-answer work item

Avoid mixing dot and hyphen in the same segment when a dot can serve as the separator. Hyphens are fine for multi-word event names (`feedback-ready`), but each domain step should be its own dot segment.

### 7. Routing-key consistency between publisher and consumer

Constants for routing keys MUST be defined exactly once per direction:

- The **owning service** declares both the exchange and the routing-key constant. Publishers in other services reference the constant via dependency injection or duplicate it as a `public static final String` only when no shared module exists.
- Every publisher and consumer of a key references the **same constant** (or a shared messaging-common envelope) — never a string literal at the call site.

Tests verifying the wiring (broker boots, declared queues bound, message round-trips) catch publisher/consumer key mismatches that would otherwise drop messages silently.

## Constants pattern

```java
// ai-svc, AiFeedbackRabbitMQConfiguration.java

// Exchange owned by this service
public static final String AI_EXCHANGE = "ai";

// Internal routing keys (single-consumer)
public static final String ANSWER_FEEDBACK_REQUESTED_ROUTING_KEY = "ai.internal.answer-feedback-requested";
public static final String INTERVIEW_FEEDBACK_REQUESTED_ROUTING_KEY = "ai.internal.interview-feedback-requested";

// Queues consumed by this service
public static final String ANSWER_FEEDBACK_REQUESTED_QUEUE = "ai.answer-feedback-requested";
public static final String INTERVIEW_FEEDBACK_REQUESTED_QUEUE = "ai.interview-feedback-requested";

// Retry / DLQ
public static final String FEEDBACK_RETRY_EXCHANGE = "ai.feedback.retry";
public static final String FEEDBACK_RETRY_QUEUE = "ai.feedback.retry.queue";
public static final String FEEDBACK_DLQ_EXCHANGE = "ai.feedback.dlq";
public static final String FEEDBACK_DLQ_QUEUE = "ai.feedback.dlq.queue";
public static final String FEEDBACK_DLQ_ROUTING_KEY = "ai.feedback.dlq";
```

## Legacy / pre-rule names

Names that pre-date this rule keep their original form. Examples currently in the codebase that are intentionally untouched:

- Exchanges `testmeai.ai`, `testmeai.interviews`, `testmeai.recruitment.events`, `testmeai.communications.events`, `testmeai.ingestion`
- Routing keys `interview.created`, `interview.started`, `interview.completed`, `interview.feedback-ready`, `ai.feedback-generated`, `ingestion.emails.process`

The three former `invitation.{revoked,consumed,expired}` routing keys were migrated to `recruitment.invitation.{revoked,consumed,expired}` in Phase 1 of the communications event-driven refactor (single coordinated deploy of recruitment-svc + interviews-svc — only consumer was interviews-svc, so the standard parallel-topic deprecation protocol was not required). They are no longer legacy entries.

When touching one of these for an unrelated reason: **do not rename it in passing**. Migration of legacy topology is its own ticket and requires the deprecation protocol (parallel topics + dual-publishing + cutover).

## When in doubt

If you can't decide whether a key should be `<service>.event` or `<service>.internal.step`, ask: *"if a sibling service one day wants to react to this, would that be a normal extension or would it indicate a leaking abstraction?"* If the latter — it's internal, prefix with `.internal.`.
