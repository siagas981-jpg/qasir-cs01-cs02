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
- Employee management /employees (owner-only): table w/ search + role/outlet filters, add (server /api/employees creates auth user, roles cashier/manager), edit, reset password without email (auth admin), deactivate (is_active; login blocked, checkout RPC ACCOUNT_INACTIVE), delete (auth user + cascade). Owner rows protected. Replaces /staff. Migration: /app/supabase/migration_employees.sql. Optional Edge Functions in /app/supabase/functions/.
- Testing: iteration_1 — backend 9/9, frontend 12/12; iteration_2 (reset password) — 11/11

## Implemented (2026-06, Inventory feature)
- Products page: added columns Harga Modal (products.cost_price), Stok Minimum (products.min_stock); kept Stok (products.stock) as current stock.
- Per-product stock actions (owner): Add Stock (purchase), Reduce Stock (adjustment/return reason), Adjust Stock (set to physical count) — each calls `record_stock_movement(p_product_id,p_type,p_delta,p_notes)` RPC (atomic: locks row, updates stock, logs movement, NEGATIVE_STOCK guard). New product's initial stock is logged as a 'purchase' movement; stock field is read-only in edit mode (change only via actions).
- Low-stock warning: row highlighted + red "Stok rendah" badge when stock <= min_stock.
- New table `public.stock_movements` (id, product_id FK, type[sale|purchase|adjustment|return], quantity signed, previous_stock, new_stock, notes, created_by FK->profiles, created_at) + RLS (same visibility as products) + grants. FK created_by->profiles enables PostgREST creator embed.
- Sale auto-logging: trigger `on_transaction_item_sale` on transaction_items deducts stock and logs a 'sale' movement. checkout() recreated WITHOUT inline deduction so the trigger is the single source (no double-decrement).
- New page `/inventory` (owner-only, nav "Inventaris"): stock movement history with filters by product and type; green/red change indicators; shows creator.
- DB migration: `/app/supabase/migration_inventory.sql` (authoritative, idempotent, self-healing: drops stale function/trigger overloads, adds grants + FK). Applied directly via pooler connection (SQL Editor runs weren't taking effect). schema.sql kept in sync.
- Testing: iteration_4 — Products inventory flows 9/9; iteration_5 — Inventory page + filters 100%. Test owner account: owner.inventory@qasirtest.com (see test_credentials.md). Test-generated data cleaned up; real products/data untouched.

## Backlog
- P1: Receipt print / share, daily sales report per outlet
- P2: QRIS/card payment method column, dark mode
- Done: Stock adjustment log / restock history (Inventory feature, 2026-06)

## Next tasks
- Disable public signups in Supabase Auth settings (recommended)
