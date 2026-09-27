# Agent web-data pilot: proposed API contract

Status: design proposal, 27 September 2026. No live POST endpoint, MCP server, automated retrieval or billing exists. `sample-response.json` is a static fictional example, not vendor data. You can fetch that file with any HTTP client without authentication.

## Proposed first job

Return public SaaS plan prices and billing conditions as structured facts with field-level source evidence. The consumer is an agent; its owner authorizes integration and spending. A successful fetch, a valid JSON object or agreement between two language models does not establish factual correctness.

## Proposed request

Future operation: `POST /v1/pricing-facts`. This path is not deployed.

```json
{
  "url": "https://example.com/pricing",
  "plan": "Team",
  "locale": "en-US",
  "currency": "USD",
  "billing_selection": "annual",
  "required_fields": ["monthly_equivalent_usd", "billing_period", "price_unit", "minimum_seats"],
  "max_age_seconds": 3600,
  "deadline_ms": 15000,
  "max_price_usd": "0.05",
  "allow_partial": false
}
```

The dollar amount is a hypothetical client limit, not an offered tariff. A future paid request needs a server-issued quote and an idempotency key before execution. The service must reject a request it cannot fulfill under those limits; it must never silently increase the budget, relax freshness, switch country/currency or omit required fields.

## Evidence and states

- A source records its final URL, actual retrieval timestamp, content hash and observed locale, currency and billing selector. A search index's crawl date must not become a new retrieval timestamp.
- Observed fields include a short supporting excerpt and an unambiguous location in the captured page. A hash proves snapshot identity, not truth.
- Derived values identify their inputs and deterministic formula. A monthly equivalent is not a monthly-billed subscription.
- Missing values are `null`, with `not_found`, `ambiguous` or `conflict` status. A sales-only quote is unknown, not zero.
- Response states: `complete`, `partial`, `unavailable`. `complete` requires all requested fields to meet the agreed validation and freshness rules.
- Failure reasons include `stale`, `blocked`, `unsupported_source`, `deadline_exceeded`, `budget_exceeded`, `source_conflict` and `required_field_missing`. Returning an error page as successful data is forbidden.
- For the proposed paid version, only an accepted complete result is billable by default. Partial results require explicit opt-in and a separate quoted price. Our upstream retries can still cost us money even when the customer is not billed.
- A result describes what the source said at retrieval time. It is not a guaranteed current commercial quote or a promise that the vendor's website is accurate.

## Pilot boundaries

The first pilot is manually scoped and may use human review. It supports selected public pricing pages only. No credentials, private customer information, paywall bypass, purchase execution or arbitrary URL proxy. An unavailable source stays unavailable.

Before production: authenticate clients, enforce tenant isolation, prevent SSRF including redirects/DNS changes, constrain external egress, treat retrieved text as untrusted data, set time/size/retry limits, redact logs, and define retention. Source access and reuse permissions must be established before collection or redistribution. Access to restricted sources would require provider agreements.

## How to evaluate the idea

Compare matched tasks against the participant's current agent and direct use of retrieval services such as Firecrawl or Parallel. Count required-field correctness, wrong assertions, unknowns, source coverage, retrieval age, elapsed time, downstream model tokens and all retry/provider costs. Build a timestamped reference set independently; do not let the extractor grade itself.

The example is not a benchmark. No accuracy, savings or reliability advantage has been established. Contact hello@aispenddoctor.com with one recurring task and 3–5 public URLs to scope a pilot.
