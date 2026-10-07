# CS Qasir — PRD

## Original problem statement
CS Qasir — Supabase Connection & Data Migration. Wire Supabase into the web app, replace localStorage with Supabase as source of truth, add Owner/Cashier auth + RLS, make checkout atomic. Cart stays local; sync on checkout. Phases: env + clients (service role server-only), schema (profiles, transactions, transaction_items; integer Rupiah), Auth + RLS (owner all outlets, cashier own outlet), atomic checkout RPC (lock rows, reject whole sale if short), replace localStorage (keep cart + offline queue with double-submit guard), health check + smoke tests.

User choices: Supabase project was empty → create all tables (outlets, products, profiles, transactions, transaction_items) with RLS; products per-outlet stock; owner seeded manually (siagas981@gmail.com); cash-only v1; no existing codebase in workspace → built new in React (CRA) + Tailwind (Next.js not available here); SQL run by user in Supabase SQL Editor.

## Architecture
- Frontend React + Tailwind + shadcn; `@supabase/supabase-js` browser client (publishable key) in `src/lib/supabase/client.js`; react-query.
- Backend FastAPI `/api` holds the secret key only: `/api/health`, `/api/staff` (owner-only cashier creation via Auth Admin API).
- Supabase: `/app/supabase/schema.sql` (tables, RLS, signup trigger, `checkout()` RPC with row locks + client_ref idempotency), `/app/supabase/grants.sql`.
- Seed: `backend/scripts/seed_supabase.py` (idempotent).

## User personas
- Owner: manages all outlets, products, staff, sees all transactions.
- Cashier: sells at one outlet only.

## Implemented (2026-10-07)
- Schema + RLS + atomic checkout RPC (oversell rejection, cross-outlet block, price from DB, idempotent client_ref)
- Login, route guards, role-based nav, owner outlet switcher
- POS: product grid with stock badges, local cart (per user+outlet), cash pay dialog with quick cash + change, receipt
- Offline queue: saves sale when offline, auto-flush on reconnect, failed entries retry/discard
- Transactions history w/ line items + today totals; Products CRUD; Outlets CRUD; Staff (create cashier, assign outlet)
- Health check on app load (console + status badge)
- Forgot/reset password: "Lupa password?" dialog on login (resetPasswordForEmail with redirectTo /reset-password), ResetPassword.jsx recovery page (PASSWORD_RECOVERY session, updateUser, alert + back to login). Tested E2E via admin generate_link. Requires redirect URL allowlisted in Supabase.
- Testing: iteration_1 — backend 9/9, frontend 12/12; iteration_2 (reset password) — 11/11

## Backlog
- P1: Receipt print / share, daily sales report per outlet
- P1: Stock adjustment log (restock history)
- P2: QRIS/card payment method column, dark mode, deactivate cashier

## Next tasks
- Disable public signups in Supabase Auth settings (recommended)
