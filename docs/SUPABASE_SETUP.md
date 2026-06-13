# Supabase Setup Guide

MedOS uses **Supabase Auth** for email/password login. This guide walks you through setting up your Supabase project.

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up (GitHub or email).
2. Click **New project**.
3. Fill in:
   - **Name:** `medos`
   - **Database Password:** Generate a strong password (save it!)
   - **Region:** Pick closest to you (Singapore, Mumbai, etc.)
   - **Pricing Plan:** Free (no credit card needed)
4. Wait ~2 minutes for the project to spin up.

## 2. Get API Credentials

1. In the Supabase dashboard, go to **Project Settings → API**.
2. Copy these two values:

   | Setting | Example |
   |---------|---------|
   | **Project URL** | `https://xxxxxxxxxxxxxx.supabase.co` |
   | **Anon Public Key** | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |

3. Paste them into your `.env` files:

   **`backend/.env`:**
   ```
   SUPABASE_URL=https://xxxxxxxxxxxxxx.supabase.co
   SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

   **`frontend/.env`:**
   ```
   VITE_SUPABASE_URL=https://xxxxxxxxxxxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   VITE_API_BASE_URL=http://localhost:8000/api
   ```

## 3. Enable Email Auth

1. Go to **Authentication → Providers**.
2. Click **Email**.
3. Toggle **Enable email sign-up** to **ON**.
4. (Optional) Disable **Confirm email** for development — this lets you create users without email verification.
5. Click **Save**.

## 4. Create Test Users

You can create users in two ways:

### Via Supabase Dashboard (easiest):
1. Go to **Authentication → Users**.
2. Click **Add User**.
3. Enter email and password.
4. Click **Create user**.

### Via the MedOS backend:
```bash
# Create a Django superuser first
cd backend
python manage.py createsuperuser

# Then assign them a hospital profile through the admin panel
# Go to http://localhost:8000/admin/ and set up roles + profiles
```

## 5. Seed Roles (Once)

```bash
cd backend
python manage.py seed_roles
```

This creates 5 default roles: Admin, Doctor, Nurse, Receptionist, Pharmacist.

## 6. Run Migrations

```bash
cd backend
python manage.py makemigrations
python manage.py migrate
```

## 7. Verify Login

1. Start the backend: `python manage.py runserver`
2. Start the frontend: `npm run dev`
3. Open http://localhost:5173
4. Sign in with the email/password you created in Supabase

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `401 Unauthorized` on login | Check your `.env` has correct Supabase URL and Anon Key |
| `Email not confirmed` | In Supabase dashboard → Auth → Providers → Email → disable "Confirm email" |
| `User already exists` | The Django backend is trying to create a user that already exists. Delete the user from Supabase Auth → Users and try again |
| Backend can't reach Supabase | Ensure `SUPABASE_URL` in `backend/.env` is correct and your internet is working |

## Architecture

```
┌─────────────┐     Supabase JWT      ┌──────────────────┐
│  React SPA  │ ──────────────────►   │  Django REST API  │
│  (Login.jsx)│     POST /api/login/  │  (validates JWT)  │
└──────┬──────┘                       └──────────────────┘
       │
       │ signInWithPassword()
       ▼
┌─────────────┐
│   Supabase  │
│    Auth     │
└─────────────┘
```
