# JETZ Sports Academy Management System

Production-ready ERP: Django + DRF + PostgreSQL backend, React + Vite admin web, React Native (Expo) trainer app.

## Structure
- `backend/` — Django project (`config/`, `apps/*`), Gunicorn, health check at `/api/health/`
- `frontend/` — Admin web (React + Vite + TypeScript)
- `trainer-app/` — Trainer mobile app (Expo, same backend APIs)
- `docs/` — API, database, deployment notes
- `docker-compose.yml` — db + backend + frontend

## Quick start (backend)
1. Install PostgreSQL, create DB `jetz_db`.
2. `cd backend && cp .env.example .env` and fill secrets.
3. `pip install -r requirements.txt`
4. `python manage.py migrate`
5. `python manage.py seed_demo` (demo login: admin / Jetz@123; also manager, coach1, parent1)
6. `python manage.py runserver` (prod: gunicorn, see docs/DEPLOYMENT.md)

## Frontend
1. `cd frontend && npm install && npm run dev` (proxy `/api` → localhost:8000).
2. `npm run build` for production.

## Trainer app
1. `cd trainer-app && npm install && npx expo start`, set `EXPO_PUBLIC_API_URL` to backend URL.

## Key business rules (enforced)
- Session-based attendance; unique (session, student); roster-checked; corrections need `attendance.correct` + reason + audit.
- Fees: amounts from `FeePlan` (configurable, never hardcoded); statuses upcoming/due/pending/partially_paid/paid/overdue/cancelled/refunded.
- Payments: frontend callback never marks paid; only verified backend webhook (`/api/payments/webhook/`) with gateway signature + idempotency.
- WhatsApp: provider abstraction (`mock|meta_cloud|twilio`), templates configurable, delivery status from webhook only.
- Trainer fees: `completed` sessions × `TrainerFeeRule.rate_per_session`; generate → verify → pay; adjustments need reason + audit.
- RBAC enforced on every backend endpoint (`HasPerm`); frontend hiding is cosmetic only.

## CONFIGURATION REQUIRED (client must confirm — not invented)
- Exact fee amounts per plan/cycle, trainer per-session rates, batch capacities, session timings.
- Payment gateway choice + credentials (`PAYMENT_GATEWAY_PROVIDER`, keys in `.env`).
- WhatsApp provider + approved template names (`WHATSAPP_PROVIDER`, tokens in `.env`).
- Coach substitution rules, parent/student login scope, branch/scheduling extensions (future scope excluded).

## API map
`/api/auth/* /api/users/* /api/sports/* /api/students/* /api/parents/* /api/coaches/* /api/batches/* /api/sessions/* /api/attendance/* /api/fees/* /api/payments/* (+/webhook/) /api/whatsapp/* (+/webhook/) /api/trainer-fees/* /api/reports/* /api/notifications/* /api/audit/* /api/settings/* /api/documents/* /api/support/* /api/customization/* /api/health/`

## Tests
- Backend: `cd backend && pytest` (auth/RBAC, attendance uniqueness, payment signature, trainer-fee eligibility).
- Frontend: `cd frontend && npm test`.
See docs/ for API, database, deployment, troubleshooting.
