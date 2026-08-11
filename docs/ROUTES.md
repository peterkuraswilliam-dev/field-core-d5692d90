# Routes

TanStack Router derives routes from `src/routes/`. Layout segments prefixed with
an underscore organize access control without necessarily appearing in the URL.

## Public and redirect routes

| URL                | Source                           | Purpose                                                            |
| ------------------ | -------------------------------- | ------------------------------------------------------------------ |
| `/`                | `src/routes/index.tsx`           | Entry redirect based on authentication state                       |
| `/auth`            | `src/routes/auth.tsx`            | Sign in and account creation; accepts validated invitation context |
| `/forgot-password` | `src/routes/forgot-password.tsx` | Request a password-reset link                                      |
| `/reset-password`  | `src/routes/reset-password.tsx`  | Set a new password from recovery state                             |
| `/accept-invite`   | `src/routes/accept-invite.tsx`   | Preview and accept a workspace invitation                          |

When an unauthenticated user opens an invitation, `/accept-invite` passes its
validated token to `/auth`. Successful sign-in, immediate signup, or an email
verification callback returns the user to the same invitation before normal
workspace routing continues.

## Authenticated routes

These routes run beneath `src/routes/_authenticated/route.tsx`.

| URL                    | Source                                   | Purpose                                         |
| ---------------------- | ---------------------------------------- | ----------------------------------------------- |
| `/onboarding`          | `_authenticated/onboarding.tsx`          | Create the user's first workspace               |
| `/blocked`             | `_authenticated/blocked.tsx`             | Explain suspended or removed access             |
| `/control-centre`      | `_authenticated/control-centre.tsx`      | Operational dashboard                           |
| `/projects`            | `_authenticated/projects/index.tsx`      | List visible projects                           |
| `/projects/new`        | `_authenticated/projects/new.tsx`        | Create a project                                |
| `/projects/:projectId` | `_authenticated/projects/$projectId.tsx` | Project overview and feature tabs               |
| `/team`                | `_authenticated/team.tsx`                | Members, invitations, roles, and audit activity |
| `/workspace-settings`  | `_authenticated/workspace-settings.tsx`  | Workspace configuration                         |

## Admin route

| URL      | Source                            | Purpose                           |
| -------- | --------------------------------- | --------------------------------- |
| `/admin` | `_authenticated/_admin/admin.tsx` | Platform administration dashboard |

The `_authenticated/_admin/route.tsx` layout checks platform-level admin access
before rendering its child route.

## Guard behavior

The authenticated layout disables SSR and verifies the current Supabase user on
the client. It then loads workspace membership unless the destination is exempt:

- `/admin`, `/onboarding`, and `/blocked` skip normal workspace loading.
- Missing authentication redirects to `/auth`.
- No workspace membership redirects to `/onboarding`.
- A non-active membership redirects to `/blocked`.

The mobile bottom navigation is hidden on onboarding and blocked screens. The
camera provider wraps authenticated routes and receives the current workspace,
user, and role-aware upload permission.

## Root behavior

`src/routes/__root.tsx` provides document metadata, global providers, error UI,
and the not-found screen. `src/routeTree.gen.ts` is generated and must not be
edited manually.
