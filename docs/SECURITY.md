# Security

This document describes the security model visible in the repository. Supabase
configuration and deployed policies must be verified independently before a
production release.

## Authentication

Supabase Auth provides email/password registration, sign-in, Google OAuth,
session lookup, password recovery, and sign-out. Protected routes call
`supabase.auth.getUser()` and redirect unauthenticated users to `/auth`.

Passwords are handled by Supabase Auth and are not stored in application tables.

## Authorization layers

Field Core uses several layers with different responsibilities:

1. Route guards prevent normal navigation into authenticated or admin screens.
2. UI permissions hide or disable actions inappropriate for the current role.
3. Postgres Row Level Security controls table reads and writes.
4. Database functions and triggers enforce sensitive multi-record operations.
5. Supabase Storage policies control project photo objects.

Route and UI checks are usability controls, not the final security boundary. RLS,
storage policies, and server-side checks must remain authoritative.

## Role systems

### Workspace roles

Workspace roles are owner, admin, project manager, field worker, contractor, and
viewer. Owners may manage every non-owner role. Admins may manage project
managers, field workers, contractors, and viewers. Project creation is available
to owners, admins, and project managers. Owners and admins have workspace-wide
project access in the client model.

### Platform roles

Platform roles are admin, moderator, and user. They are stored separately from
workspace membership. The `/admin` layout checks platform admin status.

Do not substitute one role system for the other.

## Membership and project isolation

- Active workspace membership is required for normal workspace routes.
- Suspended and removed members are routed to the blocked screen.
- Project visibility depends on workspace authority or project assignment.
- Project creation atomically assigns the creator as a project member; it does
  not grant project managers workspace-wide project visibility.
- An active member may read profile details only for users who share one of
  their workspaces. The profile policy does not expose unrelated workspace users.
- Child records carry workspace and project identifiers and are checked against
  accessible projects in policies and helper functions.
- Invitations use hashed tokens in the database and have status and expiry state.
- Auth routes carry a validated invitation token through sign-in and account
  verification, then return the user to invitation acceptance.

## Secrets and environment variables

Browser-safe variables use the `VITE_` prefix. `SUPABASE_SERVICE_ROLE_KEY` is
server-only, bypasses RLS, and must never be included in client code, logs,
screenshots, documentation values, or committed files.

Only variable names and empty placeholders belong in `.env.example`. Local `.env`
files are ignored by Git.

## Security review checklist

- Confirm every new table has RLS enabled and intentional policies.
- Test access across two users in different workspaces.
- Test owner, admin, manager, field, contractor, and viewer boundaries.
- Test suspended and removed membership behavior.
- Verify invitation expiry, reuse prevention, role limits, and email matching.
- Verify private photo reads, writes, updates, and deletion at object and metadata levels.
- Confirm admin access uses platform roles and cannot be gained from workspace roles.
- Inspect browser bundles and logs for server-only credentials.
- Review migrations for destructive operations and unsafe `SECURITY DEFINER` search paths.

## Incident-sensitive areas

Changes to auth middleware, route guards, workspace/member RPCs, project access
helpers, RLS policies, storage policies, invitations, or service-role usage require
explicit security review and manual permission testing.
