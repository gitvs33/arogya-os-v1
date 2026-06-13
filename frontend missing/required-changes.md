# Frontend Changes Required

> Backend fixes complete. These frontend changes are needed for full production readiness.
> Generated: 2026-06-11

---

## 1. Stop Storing Token in sessionStorage/localStorage

**Backend change already made:** Login response no longer includes `token` field. Auth is handled via HttpOnly cookie (`auth_token`) which is automatically set and sent by the browser.

**Frontend action:**

### `frontend/src/api/client.ts`
- [ ] Remove the `client.interceptors.request.use` block that reads token from storage and sets `Authorization` header
- [ ] Remove the `clearAuth()` calls that remove `medos_token` from both storage locations in the 401 interceptor
- [ ] `withCredentials: true` is already set — the cookie is sent automatically

### `frontend/src/pages/Login.tsx`
- [ ] Stop writing `medos_token` to `sessionStorage`/`localStorage` after login
- [ ] The token is no longer in the response body — only store `medos_user` (the user object, which still contains role, hospital, permissions, etc.)
- [ ] Login flow: after `POST /auth/login/`, just store `medos_user` from response and redirect

### `frontend/src/permissions.ts` / any other file reading `medos_token`
- [ ] Remove any reference to `medos_token` from storage — only the cookie matters now

---

## 2. Intercept `must_change_password` After Login

**Backend change already made:** Login and `/auth/me/` responses now include `must_change_password: true/false`.

**Frontend action:**

### `frontend/src/App.tsx` or route guard
- [ ] After login, check `must_change_password` from the stored user object
- [ ] If `true`, redirect to `/change-password` before allowing any other route
- [ ] Block all app routes until password is changed

### New page: `frontend/src/pages/ChangePassword.tsx`
- [ ] Form with fields: `old_password`, `new_password`, `confirm_password`
- [ ] On submit: `POST /auth/change-password/` with `{ old_password, new_password }`
- [ ] On success: update `must_change_password` to `false` in stored user, redirect to main app
- [ ] On error (wrong old password, too short, etc.): show inline validation

### `frontend/src/App.tsx`
- [ ] Add route: `<Route path="/change-password" element={<ChangePassword />} />`
- [ ] Add a route guard that redirects to `/change-password` if `must_change_password` is `true`

---

## 3. Handle 403 for Deactivated Hospital

**This already works** in `client.ts` (see the 403 interceptor that reads `hospital.is_active` and redirects to `/suspended`). But verify:

### `frontend/src/App.tsx`
- [ ] Ensure `/suspended` route exists and shows a "Your hospital account has been deactivated" message

---

## 4. Display Hospital Name + Plan Badge in Header

**Backend already sends:** `hospital: { id, name, slug, plan, is_active }` in login/me responses.

### `frontend/src/components/Layout.tsx`
- [ ] Read `hospital.name` from stored user and display it in the header/navbar
- [ ] Show a plan badge (`basic` / `professional` / `enterprise`) next to the hospital name

---

## 5. Gate UI Features by Subscription Plan

**Backend already sends:** `hospital.plan` in login/me responses.

### `frontend/src/pages/AdminPanel.tsx`
- [ ] Read `hospital.plan` from stored user
- [ ] Gray out or hide tabs/features not available in the current plan:
  - `basic`: core EMR, basic billing
  - `professional`: + TeleICU, lab module, advanced analytics
  - `enterprise`: + AI scribe, custom integrations, API access
- [ ] Show "Upgrade" badge on restricted features

---

## 6. Filter Role Dropdown by Hospital

**Backend already handles this** — roles are scoped per hospital automatically. But the frontend currently uses a hardcoded `ROLES` array:

### `frontend/src/pages/admin-tabs/UserManagement.tsx`
- [ ] Replace `const ROLES = ['Chief of Surgery', 'Head Nurse', ...]` with an API call to `GET /api/admin/roles/`
- [ ] Populate the role dropdown from the response (which only includes roles from the user's hospital)

---

## Summary of Files to Change

| File | Changes |
|---|---|
| `frontend/src/api/client.ts` | Remove token-from-storage interceptor |
| `frontend/src/pages/Login.tsx` | Stop writing token to storage |
| `frontend/src/App.tsx` | Add `/change-password` route + guard; ensure `/suspended` route |
| `frontend/src/pages/ChangePassword.tsx` | **NEW** — password change form |
| `frontend/src/components/Layout.tsx` | Show hospital name + plan badge |
| `frontend/src/pages/AdminPanel.tsx` | Gate tabs by subscription plan |
| `frontend/src/pages/admin-tabs/UserManagement.tsx` | Fetch roles from API instead of hardcoded list |
| Any file referencing `medos_token` | Remove storage reads |
