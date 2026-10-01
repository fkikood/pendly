# Pendly Plus: staged entitlement foundation

## Product boundary
The existing free commuter-cost comparison, personal trip records, account access, data export, account deletion, privacy controls, and feedback remain free. This branch only prepares entitlement storage; it does not activate a paywall, checkout, recurring billing, or provider credentials.

## Proposed Plus capabilities
- Extended trip history and period comparisons
- Saved recurring routes
- Multiple vehicle profiles
- Advanced monthly/yearly analysis and enhanced CSV export

€2.99/month and €24.99/year are discussion examples only; they are not configured or published.

## Entitlement rules
`public.user_entitlements` is the server-owned source of truth. A client may read its own row but cannot create or modify entitlements. Trusted server-side billing/webhook code must update records only after provider signature verification and idempotency checks. `public.has_pendly_plus()` provides a common authenticated entitlement predicate. Sensitive data operations must enforce entitlement server-side, not merely hide UI.

## Safe rollout sequence
1. Review and apply the migration in a release.
2. Implement verified billing-provider webhook handling (not included here).
3. Add server-side authorization to explicitly selected Plus capabilities.
4. Add UI labels and subscription management.
5. Test active, canceled, past-due, expired, duplicate webhook, account deletion, and offline states.
6. Enable checkout only after prices, cancellation/refund terms, legal copy, and support are approved.

No paid AI/API feature is included.
