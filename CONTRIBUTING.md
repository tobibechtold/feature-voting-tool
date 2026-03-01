# Contributing

Thanks for contributing to `feature-voting-tool`.

## Requirements

- Node.js 20+
- npm 10+
- Supabase CLI
- A linked Supabase project for integration changes

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy env file and set required variables:

```bash
cp .env-example .env
```

3. (Optional) Link to your Supabase project:

```bash
npm run supabase:login
npm run supabase:link -- --project-ref <your-project-ref>
```

## Development workflow

1. Create a feature branch.
2. Make focused changes.
3. Run checks locally:

```bash
npm run test
npm run build
```

4. If you changed Supabase schema/functions, also run:

```bash
npm run supabase:db:push
npm run supabase:functions:deploy
```

## Pull requests

Please include:

- What changed
- Why it changed
- Any env/secrets/migration impact
- Screenshots for UI changes
- Test/verification notes

## Coding guidelines

- Keep changes small and scoped.
- Do not commit secrets or `.env` files.
- Document new environment variables in `README.md`.
- Document new operational steps when adding integrations.

## Reporting issues

When opening a bug report, include:

- Reproduction steps
- Expected result
- Actual result
- Browser/OS details
- Relevant logs or screenshots
