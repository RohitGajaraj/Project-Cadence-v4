# docs/auth-flows.md — Authentication flows

> How users sign in, sign up, recover access, and manage their session. Tightly coupled to [`architecture/security.md`](../architecture/security.md).

## Supported methods

| Method           | Route                                  | Notes                                          |
| ---------------- | -------------------------------------- | ---------------------------------------------- |
| Email + password | `/login`                               | Primary path. Password must be ≥ 6 characters. |
| Google OAuth     | `/login`, `/signup`                    | Brokered through Lovable auth.                 |
| Password reset   | `/forgot-password` → `/reset-password` | Self-service, email-delivered link.            |

## Sign-up (`/signup`)

1. User enters full name, role, email, and password.
2. `supabase.auth.signUp()` creates the auth user.
3. A profile row is upserted into `public.profiles` with `onboarded: true`.
4. Auto-confirm is enabled, so the user is signed in immediately and redirected to `/`.

## Sign-in (`/login`)

1. User enters email and password.
2. `supabase.auth.signInWithPassword()` authenticates.
3. On success, `SIGNED_IN` event fires, queries are invalidated, and the router redirects to `/`.
4. `beforeLoad` on `/login` and `/signup` auto-redirects authenticated users to `/`.

### Password visibility toggle

The password field on `/login` includes a show/hide toggle:

- **Icon:** `Eye` (show) / `EyeOff` (hide) from `lucide-react`.
- **State:** `showPassword` boolean toggled by an absolute-positioned button inside the input wrapper.
- **Accessibility:** `aria-label` switches between "Show password" and "Hide password".
- **Styling:** Input has `pr-10` so text does not overlap the toggle button.

### “Forgot password?” link

Below the password field, a "Forgot password?" link routes to `/forgot-password`.

## Password reset flow

### 1. Request reset link (`/forgot-password`)

1. User enters their email address.
2. `supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/reset-password' })` sends the reset email.
3. UI shows a confirmation state with the email address and a "Send again" button.
4. If the email does not exist, Supabase returns success (no user enumeration).

### 2. Set new password (`/reset-password`)

1. The reset email contains a link to `/reset-password#access_token=...&type=recovery`.
2. On mount, the page checks `window.location.hash` for `type=recovery` or `access_token=`.
   - If missing/invalid, the page shows an error with a link back to `/forgot-password`.
3. User enters a new password (≥ 6 characters) and confirms it.
   - The new-password field also includes the show/hide toggle (same pattern as `/login`).
4. `supabase.auth.updateUser({ password })` updates the password.
5. On success, the UI shows a confirmation with a "Sign in" button linking back to `/login`.

## Session lifecycle

- **Persistence:** Supabase stores the session in `localStorage`.
- **Bearer attachment:** `attachSupabaseAuth` middleware reads `supabase.auth.getSession()` and attaches the access token to every `createServerFn` RPC automatically.
- **State change listener:** `src/routes/__root.tsx` listens to `SIGNED_IN` / `SIGNED_OUT` only. `SIGNED_OUT` cancels and clears the TanStack Query cache to prevent 401 refetches.
- **Protected routes:** All authenticated routes live under `/_authenticated/*` and are gated by the integration-managed `ssr: false` layout.

## Demo accounts

See [`demo-credentials.md`](./demo-credentials.md) for pre-provisioned accounts used in demos and screen recordings.

## Related

- [`architecture/security.md`](../architecture/security.md) — Auth, tenancy, RLS, and governance.
- [`architecture/frontend.md`](../architecture/frontend.md) — Route and loader patterns.
- [`demo-credentials.md`](./demo-credentials.md) — Demo login details.
