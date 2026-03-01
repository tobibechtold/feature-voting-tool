# feature-voting-tool

Feature Voting Tool for my apps. Deployed at https://featurevoting.tobibechtold.dev

If you want to use this tool as well for free, you can deploy this in anywhere you'd like (Vercel, Netlify etc). 
For this to work you need to create a supabse project first and follow the instructions below.

## Environment variables

Copy `.env-example` to `.env` and fill in your values:

```bash
cp .env-example .env
```

Required variables:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_RECAPTCHA_SITE_KEY`

## Supabase (open-source setup)

This repo keeps Supabase infrastructure in the `supabase/` folder:
- `supabase/config.toml`
- `supabase/functions/*`
- `supabase/migrations/*` (generated via `supabase db pull`)

### Fast deploy for contributors

1. Create a new Supabase project in the dashboard.
2. Link this repo to that project.
3. Push migrations.
4. Deploy edge functions.

```bash
npm run supabase:login
npm run supabase:link -- --project-ref <new-project-ref>
npm run supabase:db:push
npm run supabase:functions:deploy
```

Update your local `.env` with the new project URL and anon key after deployment.

Then configure edge function secrets:

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

### Create the admin user

1. Open Supabase
2. Go to Authentication
3. Enable Email and Password and create a user
4. Copy the UID and create an entry in the user_roles table with your UID and the role admin

### Enable Email sending

The feature-voting-tool uses Resend to send notification emails to you and your users.
