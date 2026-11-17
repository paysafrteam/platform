# PaySafr

Escrow and invoicing for freelancers and online sellers in Nigeria. A seller shares a payment link, the buyer pays by bank transfer with no account, PaySafr holds the money, and releases it when the buyer confirms, when the review window ends, or when an admin settles a dispute.

Next.js 16 (App Router, Cache Components) + PostgreSQL. Money is integer kobo everywhere; every naira is recorded in an append-only ledger.

## Run it locally

```bash
cp .env.example .env.local          # fill in DATABASE_URL, OTP_PEPPER, CRON_SECRET (openssl rand -hex 32)
npm install
npm run db:migrate                  # applies db/migrations/*.sql
ADMIN_SEED_EMAIL=you@x.com ADMIN_SEED_PASSWORD='a-long-password' npm run seed:admin
npm run dev                         # http://localhost:3000
```

- Sign up as a seller at `/get-started`. With no SMTP configured in sandbox, the verification code is written to `.dev-outbox/*.json`.
- Admin console: `/admin/sign-in`.
- On a payment page in sandbox, **Simulate this bank transfer** stands in for the buyer's bank transfer.
- Background jobs (expire unpaid orders, reminders, auto-release, payout retries): call `POST /api/cron/tick` with `Authorization: Bearer $CRON_SECRET` every 1 to 5 minutes (GitHub Actions, cron-job.org, Vercel Cron), or run `npm run jobs:tick` locally.

Scripts: `npm test` (needs a `paysafr_test` database, see below), `npm run lint`, `npm run typecheck`, `npm run build`, `npm run admin:set-password -- <email>`.

Tests: `createdb paysafr_test` then `TEST_DATABASE_URL=postgres://... npm test`. The suite drops and recreates the `public` schema of that database, so never point it at real data.

## Architecture

| Area | Where |
| --- | --- |
| Schema and constraints | `db/migrations/0001_init.sql` (ledger and audit log are append-only via triggers; a trigger refuses any ledger entry that would take an order's held balance below zero) |
| Money services | `src/server/services/` : `funding` (the only code that credits an order), `settlement` (release), `disputes`, `payouts`, `jobs`, `trust`, `receipts`, `orders`, `admin` |
| Payment rail | `src/server/payments/provider.ts` interface, `simulator.ts` implementation. Nothing else may talk to Paga. |
| HTTP | `src/app/api/**/route.ts`, all wrapped by `withApi` (Origin check, zod validation, auth, rate limits, uniform errors) |
| Auth | Email + password, 6-digit emailed OTP (hashed, 5 attempts, 10 min), DB-backed sessions in httpOnly cookies, separate admin sessions with lockout. `src/proxy.ts` is an optimistic gate; layouts and every API route re-check. |
| Shared types | `src/lib/domain/types.ts`. Public (buyer) DTOs never include seller contact or bank details. |

State rules, fee tiers (1.5% up to ₦50,000, 2% above; paid by the seller) and time defaults follow the project documentation. Settings editable by admins: review window, unpaid expiry, dispute response time.

## Decisions where the blueprint and plan differed or were silent

- **Project documentation wins.** Disputes can be opened by either side; a buyer can also dispute a *pending* milestone after the delivery deadline (documentation section 12: missed deadline means a refund can be requested).
- **Plain SQL + `pg` instead of an ORM.** Money code needs explicit row locks (`FOR UPDATE`), triggers and deferred constraints; plain SQL keeps that visible and reviewable.
- **Change requests:** capped at two per milestone; the seller can re-deliver, which restarts the review window.
- **Milestones settle in order:** the next milestone can be delivered only after the previous one is released or refunded.
- **Overpayment / late payment:** recorded, flagged, and refundable from the admin order page ("Refund unallocated funds"). Crediting an overpayment to the order is not offered.
- **Trust score:** weights from the documentation with the response-time component omitted until tracked (others rescaled); "New" until three qualifying orders; only released orders of at least ₦1,000 whose buyer contact differs from the seller's count.
- **Seller name** is shown to buyers as entered at sign-up.

## Not done yet (be aware before launch)

- **Paga integration.** There is no Paga sandbox access or API specification in this project, so collections, payout and webhook verification are implemented against the `PaymentProvider` interface with a simulator. `POST /api/webhooks/paga` deliberately returns 501. Items to confirm with Paga are listed in the documentation, section 8.5.
- **Bank account name verification** needs a resolver; sellers type the account name and it is saved unverified.
- **File uploads** for proof and evidence (links and notes only for now).
- SMS/WhatsApp notifications, seller identity verification, buyer standing for repeated false disputes, admin seller-detail page.
- **Licensing:** holding customer funds in Nigeria needs licensed infrastructure (documentation section 8.6). This is not legal advice.
- The Degular and Halfre fonts in `public/fonts` are demo/personal-use licences. Obtain commercial licences before launch (see `src/app/layout.tsx`).

## Security notes

Secrets live only in environment variables. API keys never reach the client. Cookies are httpOnly (`__Host-` prefixed in production). Payment link tokens are 256-bit random values. Passwords use bcrypt cost 12. All state-changing requests require a same-origin `Origin`. Rate limits are stored in Postgres, so they hold across serverless instances.
