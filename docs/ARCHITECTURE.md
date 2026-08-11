# Architecture

This document gives contributors and coding agents a fast, durable map of Field
Core. It describes the current repository rather than a future roadmap.

## Runtime shape

Field Core is a TanStack Start application with browser and server execution.
TanStack Router provides file-based routing, TanStack Query manages asynchronous
client state, and Supabase provides authentication, database access, storage,
and authorization through Row Level Security.

## Repository map

| Path | Responsibility |
| --- | --- |
| `src/routes/` | File-based routes, layouts, redirects, and route guards |
| `src/routes/_authenticated/` | Signed-in application routes |
| `src/components/` | Shared and feature-level React components |
| `src/components/ui/` | Reusable UI primitives |
| `src/components/project-tabs/` | Project tasks, progress, photos, notes, and activity views |
| `src/lib/` | Feature data operations and domain helpers |
| `src/integrations/supabase/` | Supabase clients, middleware, and generated database types |
| `supabase/migrations/` | Ordered, forward-only database changes and policies |
| `public/` | Installable-app metadata, service worker, icons, and static assets |
| `.openai/` | Hosting metadata used by the project environment |

## Route groups

Public routes cover authentication, invitation acceptance, password recovery,
and reset flows. The `_authenticated` layout enforces signed-in access and hosts
onboarding, the Control Centre, projects, team management, workspace settings,
blocked-member handling, and the admin area. The nested `_admin` layout applies
the additional administrator check.

`src/routeTree.gen.ts` is generated from route files and must not be edited by
hand. Route naming details live in `src/routes/README.md`.

## Domain modules

Feature operations are grouped by domain in `src/lib/`:

- `workspace.ts`, `team.ts`, and `roles.ts` handle workspace membership and roles.
- `projects.ts` handles projects and project membership.
- `tasks.ts`, `progress.ts`, `photos.ts`, `notes.ts`, and `activity.ts` support
  project execution and history.
- `error-capture.ts` and `error-page.ts` support error reporting and fallback UI.

Database-backed types come from `src/integrations/supabase/types.ts`. Schema and
type changes should remain synchronized.

## Security boundaries

Authorization must be enforced by Supabase policies, not only by hidden controls
or route redirects. Keep these boundaries explicit:

- A user must not read or mutate another workspace's data without membership.
- Role changes and invitations must respect the actor's management authority.
- Admin-only routes require server-verifiable administrative access.
- Private project photos must follow storage bucket and object policies.
- The service-role key is server-only and bypasses Row Level Security; use it
  narrowly and never include it in browser bundles.

## Generated and local artifacts

Do not manually edit generated route or database type output. Local `.env` files,
build directories, deployment state, package stores, database backups, and tool
caches are excluded by `.gitignore` and should remain untracked.

## Validation baseline

The current baseline is ESLint plus a production build:

```sh
pnpm lint
pnpm build
```

There is no automated test script yet. Changes to authentication, permissions,
invitations, and role-specific behavior therefore require explicit manual
verification until automated coverage is added.
