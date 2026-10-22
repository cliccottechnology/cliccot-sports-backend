# Side-by-side role sessions (dev)

Browser tabs on one origin share one token jar — that is web behaviour, not a
bug. To test two roles at once (e.g. HARI + a school admin) in tabs of the
same browser, serve the same build on **two origins**. Storage (and therefore
sessions) is isolated per origin, so the tokens can never overwrite each other.

## Run it

```powershell
# terminal 1 — academy staff portal
npm run dev:admin      # http://localhost:5173/login

# terminal 2 — super admin portal
npm run dev:super      # http://localhost:5174/super-admin/login
```

Both proxy `/api` to the same backend (`localhost:8000`), so data is shared
while sessions stay independent. Log in as different accounts in each tab.

## How it works

- `dev:super` serves on port 5174 (`--strictPort`, never silently shifts).
- The app detects the super origin (`VITE_PORTAL=super` or port `5174`,
  see `isSuperOrigin` in `src/api/session.ts`) and defaults unauthenticated
  visits to `/super-admin/login` instead of `/login`.
- Tab titles carry `section · username · academy`, so the two tabs are easy
  to tell apart.
- Logout clears only its own origin's session; the other tab is untouched.
- The 60-minute absolute session cap, forced password change, and per-request
  RBAC behave identically on both origins (same code, same backend).

## Production equivalent

Serve the same `dist/` build on two origins (e.g. `admin.example.com` and
`super.example.com`, or two ports behind the proxy) with `/api` proxied to
Django. No code changes needed — isolation comes from the origins.

## Alternative

Separate browser profiles (or browsers) also isolate storage and work with a
single origin. Same-profile tabs on one origin will always share a session.
