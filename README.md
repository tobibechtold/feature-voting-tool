# feature-voting-tool

Feature Voting Tool for my apps. Deployed at https://featurevoting.tobibechtold.dev.

If you want to use this tool for your own apps, you can deploy it to any static host (for example Vercel or Netlify) and connect it to your own Supabase project.

## 1. Prerequisites

- A Supabase project
- A Resend account (for email notifications)
- A Google reCAPTCHA v3 key pair (site key + secret key)

## 2. Frontend environment variables (`.env`)

Copy `.env-example` to `.env`:

```bash
cp .env-example .env
```

Set these variables:

| Variable | Required | Description |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Yes | Your Supabase project URL (`https://<project-ref>.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | Yes | Your Supabase anon/publishable key |
| `VITE_RECAPTCHA_SITE_KEY` | Yes | Public reCAPTCHA v3 site key used by the frontend |

### Hosting (Vercel / Netlify) build-time variables

`VITE_*` values are injected at build time. You must set them in your hosting provider before running a production build.

- Vercel: Project Settings -> Environment Variables
- Netlify: Site configuration -> Environment variables
- Redeploy after changing any `VITE_*` variable

## 3. Supabase project setup

This repo keeps Supabase infrastructure in `supabase/`:
- `supabase/config.toml`
- `supabase/functions/*`
- `supabase/migrations/*`

Run:

```bash
npm run supabase:login
npm run supabase:link -- --project-ref <your-project-ref>
npm run supabase:db:push
npm run supabase:functions:deploy
```

## 4. Edge Function secrets (Supabase)

Set these in Supabase secrets (used by `send-notification` and `verify-comment` edge functions):

| Secret | Required | Used by | Description |
| --- | --- | --- | --- |
| `RESEND_API_KEY` | Yes | `send-notification` | API key from Resend |
| `NOTIFICATION_FROM_EMAIL` | Yes | `send-notification` | Sender email, must be verified in Resend domain |
| `NOTIFICATION_FROM_NAME` | No | `send-notification` | Sender display name (default: `Feature Vote`) |
| `ADMIN_NOTIFICATION_EMAIL` | Yes | `send-notification` | Admin inbox for new feedback notifications |
| `APP_BASE_URL` | Yes | `send-notification` | Public app URL, for links in email (`https://your-domain.com`) |
| `RECAPTCHA_SECRET_KEY` | Yes | `verify-comment` | Secret reCAPTCHA key from Google |
| `RECAPTCHA_MIN_SCORE` | No | `verify-comment` | Minimum accepted score from `0` to `1` (default: `0.5`) |

Set all secrets at once:

```bash
supabase secrets set \
  RESEND_API_KEY=your_resend_api_key \
  NOTIFICATION_FROM_EMAIL=noreply@your-domain.com \
  NOTIFICATION_FROM_NAME="Feature Vote" \
  ADMIN_NOTIFICATION_EMAIL=support@your-domain.com \
  APP_BASE_URL=https://your-domain.com \
  RECAPTCHA_SECRET_KEY=your_recaptcha_secret_key \
  RECAPTCHA_MIN_SCORE=0.5
```

## 5. Resend setup

1. Create a Resend account at https://resend.com.
2. Add and verify your sending domain in Resend (DNS records required).
3. Create an API key with permission to send emails.
4. Choose a sender email on your verified domain (for example `noreply@your-domain.com`).
5. Set:
   - `RESEND_API_KEY`
   - `NOTIFICATION_FROM_EMAIL`
   - `NOTIFICATION_FROM_NAME`
   - `ADMIN_NOTIFICATION_EMAIL`

Notes:
- `NOTIFICATION_FROM_EMAIL` must belong to a verified sender/domain in Resend.
- `ADMIN_NOTIFICATION_EMAIL` can be any inbox where you want admin alerts.
- Sending might fail until SPF/DKIM DNS records are fully propagated and verified by Resend.

## 6. Google reCAPTCHA v3 setup

1. Open Google reCAPTCHA admin console: https://www.google.com/recaptcha/admin/create
2. Create a new key.
3. Choose **reCAPTCHA v3**.
4. Add your domains:
   - Production domain (for example `your-domain.com`)
   - Local domain for development (`localhost`)
5. Create the key pair and copy:
   - **Site key** -> set `VITE_RECAPTCHA_SITE_KEY` in `.env`
   - **Secret key** -> set `RECAPTCHA_SECRET_KEY` in Supabase secrets
6. (Optional) tune `RECAPTCHA_MIN_SCORE` in Supabase secrets (default is `0.5`).

Important:
- reCAPTCHA keys are domain-bound. If your deployed domain is not listed, token verification will fail.
- When adding preview domains, register each domain you plan to use.

## 7. Create the admin user

1. Open Supabase dashboard.
2. Go to Authentication.
3. Enable Email/Password and create a user.
4. Copy the user UID.
5. Insert a row in `user_roles` with that UID and role `admin`.

## 8. Supabase Auth configuration

In Supabase Dashboard -> Authentication -> Providers:

- Enable **Email** provider
- Enable **Email + Password** sign-in
- For first-time setup, you can keep email confirmation disabled for manual admin creation

If you enable email confirmation later, ensure admin users are confirmed before login.

## 9. Bootstrap data (first app + admin role)

After creating your first auth user, run SQL in Supabase SQL Editor (replace placeholders):

```sql
insert into public.user_roles (user_id, role)
values ('<ADMIN_USER_UUID>', 'admin')
on conflict (user_id, role) do nothing;

insert into public.apps (name, slug)
values ('My App', 'my-app')
on conflict (slug) do nothing;
```

## 10. Post-deploy verification checklist

Run these checks in order:

1. Open the public page and verify app list loads.
2. Create a feedback item as a public user.
3. Confirm admin receives a "new feedback" email.
4. Open the feedback detail page and submit a user comment with reCAPTCHA.
5. Confirm the comment is stored in Supabase `comments`.
6. As admin, change feedback status and verify submitter notification email.
7. As admin, reply to the thread and verify comment-reply notification emails.
