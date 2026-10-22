# API documentation
Base: `/api`. Auth: JWT Bearer (`POST /api/auth/login/`, `POST /api/auth/refresh/`).
All list endpoints: `?page=&page_size=&search=&ordering=` + filterset fields; reports support `?format=json|csv|excel|pdf`.
- Auth: login/refresh/logout/me
- Users/roles/permissions, sports (sports/categories/locations/session-types), settings
- Students, parents (+links), coaches (+sports/availability/assignments), batches (+rosters)
- Sessions (+my_sessions, +today, +change_status), attendance (+roster, +bulk_mark, +photo_analyze)
- Fees (plans, allocations, +adjust, +overdue), payments (+refund, webhook)
- WhatsApp templates/messages (+retry, webhook), trainer-fees (rules/payables/generate/verify/payments/adjustments)
- Reports: dashboard/students/fees/attendance/sessions/trainer-fees/payments/whatsapp/audit/coach-allocation
- Notifications, audit logs, documents.
Permissions enforced server-side (see seed_demo.py codenames).
