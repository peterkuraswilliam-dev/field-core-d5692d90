# Field Core

Field Core is a mobile-first contractor project-management app for organizing
workspaces, projects, site activity, and field teams. The interface uses a dark
navy and warm gold design system with large, touch-friendly controls.

## Current capabilities

- Email/password and Google authentication through Supabase
- Password recovery, protected routes, invitations, and onboarding
- Workspace membership, roles, team management, and audit activity
- Project creation, membership, status tracking, tasks, and progress updates
- Project photos, notes, activity history, and workspace settings
- Administrative access controls and a mobile app shell

## Technology

- React 19 and TypeScript
- TanStack Start, Router, and Query
- Vite 8 and Tailwind CSS 4
- Supabase Authentication, Postgres, Storage, and Row Level Security
- pnpm 11 and Node.js 24
- Vercel Build Output API deployment

See [the documentation index](docs/README.md) for product, feature, route, data,
security, development, and deployment references. Codex and other coding agents
should also read [`AGENTS.md`](AGENTS.md).

## Local setup

Prerequisites:

- Node.js 24.x
- pnpm 11.x
- Access to a configured Supabase project

Install and configure:

```sh
pnpm install
cp .env.example .env
pnpm dev
```

On Windows PowerShell, replace the copy command with:

```powershell
Copy-Item .env.example .env
```

Fill in the public and server-side Supabase values in `.env`. The service-role
key is optional and must only be used by trusted server-side code. Never prefix
it with `VITE_`.

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the local development server |
| `pnpm build` | Create a production build |
| `pnpm build:dev` | Build with development mode variables |
| `pnpm preview` | Preview the production build locally |
| `pnpm lint` | Run ESLint |
| `pnpm format` | Format supported files with Prettier |

The project does not currently define an automated test command.

## Environment variables

The canonical list is in `.env.example`.

| Variable | Exposure | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_PROJECT_ID` | Browser | Public Supabase project identifier |
| `VITE_SUPABASE_URL` | Browser | Public Supabase API URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Browser | Public publishable key |
| `SUPABASE_PROJECT_ID` | Server | Server-side project identifier |
| `SUPABASE_URL` | Server | Server-side Supabase API URL |
| `SUPABASE_PUBLISHABLE_KEY` | Server | Server-side publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Optional privileged operations |

Do not commit `.env` files or real credentials.

## Supabase

Database history is stored in `supabase/migrations/`. Apply migrations in order
to the intended Supabase project. Authentication must allow the local and
deployed callback URLs used for sign-in and password recovery. Google OAuth also
requires the provider credentials and redirect URL configured in the Supabase
dashboard.

Row Level Security is part of the application boundary. Review policies whenever
tables, roles, invitations, project membership, or storage behavior changes.

## Deployment

Import the repository into Vercel and keep the detected TanStack Start framework
settings. Configure the variables above for Development, Preview, and Production
as appropriate. Add production and required preview domains to the Supabase Auth
redirect allow-list.

Before deployment, run:

```sh
pnpm lint
pnpm build
```
