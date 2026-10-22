# Deployment
- Backend: Gunicorn behind Nginx/Caddy with HTTPS; `python manage.py migrate` on release; `collectstatic` via WhiteNoise; health: `GET /api/health/`.
- Frontend: `npm run build`, serve `dist/` over HTTPS; set API base to backend origin; CORS in backend `.env`.
- DB: PostgreSQL 15; nightly `pg_dump`; restore with `pg_restore`.
- Backups: DB dump + `media/` directory.
- Env: never commit `.env`; use `.env.example` keys.
