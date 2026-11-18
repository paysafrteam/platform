# PaySafr

Escrow and invoicing for freelancers and online sellers in Nigeria. A seller shares a payment link, the buyer pays by bank transfer with no account, PaySafr holds the money, and releases it when the buyer confirms, when the review window ends, or when an admin settles a dispute.

Next.js 16 (App Router, Cache Components) + PostgreSQL. Money is integer kobo everywhere; every naira is recorded in an append-only ledger.

## Run it locally

```bash
cp .env.example .env.local          # add URLs from a non-production Neon branch and generate OTP_PEPPER / CRON_SECRET
npm install
npm run db:migrate                  # applies db/migrations/*.sql
# set ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD temporarily in .env.local, then:
npm run seed:admin
npm run dev                         # http://localhost:3000
```

- `DATABASE_URL` must be the pooled Neon URL. Use a non-production Neon branch for local development. `DATABASE_URL_UNPOOLED`, when set, must be the direct URL for the same Neon branch. Production startup and database administration scripts reject non-Neon URLs.
- Admin sign-in uses the `admin_users` and `admin_sessions` tables in this same database. Run `npm run seed:admin` once after migration; use `npm run admin:set-password -- <email>` to reset an existing admin password. Remove `ADMIN_SEED_PASSWORD` from `.env.local` after seeding.
- Sign up as a seller at `/get-started`. With no SMTP configured in sandbox, the verification code is written to `.dev-outbox/*.json`.
- Admin console: `/admin/sign-in`.
- On a payment page in sandbox, **Simulate this bank transfer** stands in for the buyer's bank transfer.
- Background jobs (expire unpaid orders, reminders, auto-release, payout retries): call `POST /api/cron/tick` with `Authorization: Bearer $CRON_SECRET` every 1 to 5 minutes (GitHub Actions, cron-job.org, Vercel Cron), or run `npm run jobs:tick` locally.

For production, run `npm run db:migrate` manually against the production Neon branch before starting the new app version. Set `DATABASE_URL_UNPOOLED` to the direct connection URL from that same branch; migrations are deliberately not run during build or startup. The migration creates the schema, including `admin_users` and `admin_sessions`; seed the first admin once afterward.

The build requires `NEXT_PUBLIC_APP_URL` and `NEXT_PUBLIC_APP_ENV` because Next.js embeds `NEXT_PUBLIC_*` values into browser assets. The repository's `.env.production` supplies non-secret Litehost demo defaults; override them in the hosting build/runtime environment when the domain changes. Keep database credentials and other secrets in Litehost settings, never in `.env.production`. Production startup refuses simulator payments and non-live Paga configuration. For an HTTP demo use `NEXT_PUBLIC_APP_ENV=sandbox`; use `PAYMENT_MODE=paga` only with Paga sandbox credentials and a callback URL the provider accepts, or use the simulator. Set `COOKIE_SECURE=true` and use HTTPS before real users or payments. Production also needs SMTP, Paga live credentials, and a scheduled `POST /api/cron/tick` call every 1 to 5 minutes over HTTPS with the `CRON_SECRET`.

Scripts: `npm test` (requires a dedicated `TEST_DATABASE_URL`, see below), `npm run lint`, `npm run typecheck`, `npm run build`, `npm run admin:set-password -- <email>`.

Tests: set `TEST_DATABASE_URL` to a dedicated disposable PostgreSQL test database (for example, a separate Neon branch), then run `npm test`. The suite drops and recreates the `public` schema, so never point it at the production Neon database.

## Architecture

| Area | Where |
| --- | --- |
| Schema and constraints | `db/migrations/0001_init.sql` (ledger and audit log are append-only via triggers; a trigger refuses any ledger entry that would take an order's held balance below zero) |
| Money services | `src/server/services/` : `funding` (the only code that credits an order), `settlement` (release), `disputes`, `payouts`, `jobs`, `trust`, `receipts`, `orders`, `admin` |
| Payment rail | `src/server/payments/provider.ts` interface, `simulator.ts` sandbox implementation, and `paga.ts` adapter with a Paga webhook route. |
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

- **Paga integration is not provider-verified.** A Paga adapter and signed-webhook handler exist, but this project has not validated their request, callback, payout, refund, or signature formats against Paga's current documentation or sandbox. Do not enable live payments until Paga confirms the integration and it passes sandbox tests.
- **Bank account name verification** is optional via `BANK_RESOLVER=paga`; with the default manual resolver, sellers type the account name and it is saved unverified.
- **File uploads** for proof and evidence (links and notes only for now).
- SMS/WhatsApp notifications, seller identity verification, buyer standing for repeated false disputes, admin seller-detail page.
- **Licensing:** holding customer funds in Nigeria needs licensed infrastructure (documentation section 8.6). This is not legal advice.
- The Degular and Halfre fonts in `public/fonts` are demo/personal-use licences. Obtain commercial licences before launch (see `src/app/layout.tsx`).

## Security notes

Secrets live only in environment variables. API keys never reach the client. Cookies are httpOnly (`__Host-` prefixed in production). Payment link tokens are 256-bit random values. Passwords use bcrypt cost 12. All state-changing requests require a same-origin `Origin`. Rate limits are stored in Postgres, so they hold across serverless instances.
