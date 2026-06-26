# Stripe Billing Runbook

This app sells project-creation credits through Stripe Checkout. A project
creation consumes one credit unless the builder account is marked unlimited.

## Environment

Add these to `.env.local` before testing hosted Checkout:

```txt
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PROJECT_CREDIT_PRICE_ID=price_...
SUPABASE_SERVICE_ROLE_KEY=...
ADMIN_EMAILS=test@gmail.com
```

Keep `SUPABASE_SERVICE_ROLE_KEY` server-only. It is used by the Stripe webhook
and admin billing page because those flows must write credit ledger rows across
organisations.

`ADMIN_EMAILS` is a comma-separated allowlist for manual billing adjustments.
Keep `test@gmail.com` while testing, then replace or extend it before inviting
real operators.

## Supabase

Run `docs/supabase-add-project-credits-stripe.sql` after the main schema. It
adds:

- `project_credit_accounts`
- `project_credit_events`
- `consume_project_credit(...)`
- `apply_project_credit_purchase(...)`

Run this once after creating the `test@gmail.com` builder workspace:

```sql
select public.ensure_test_project_credits();
```

## Stripe

Create a one-time Price in Stripe for the project credit product. Put the Price
ID in `NEXT_PUBLIC_STRIPE_PROJECT_CREDIT_PRICE_ID`.

Local webhook testing with the Stripe CLI:

```powershell
stripe listen --forward-to http://127.0.0.1:3000/api/billing/webhook
```

Copy the printed `whsec_...` value into `STRIPE_WEBHOOK_SECRET`, then restart
the Next dev server.

Trigger a checkout from `/builder/settings`, complete payment with Stripe test
card `4242 4242 4242 4242`, then verify:

- `/admin/billing` shows the updated credit balance.
- `/admin/billing` shows a `stripe_checkout_completed` ledger event.
- Creating a builder project decrements one metered credit.

## Operator Recovery

If a payment succeeds but credits do not appear, check the webhook endpoint
configuration and server logs first. Use `/admin/billing` manual adjustment only
after confirming the expected Stripe payment/session, and write the Stripe
session or payment reference in the adjustment note.
