# Deployment

## Vercel

The standard production target is Vercel. Import the repository and keep the
detected TanStack Start framework settings. `pnpm build` produces the expected
TanStack/Nitro output and Vercel Build Output API structure.

Configure the required variables for Development, Preview, and Production:

- `VITE_SUPABASE_PROJECT_ID`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_PROJECT_ID`
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` only when trusted server-side admin operations need it

Never expose the service-role key with a `VITE_` prefix.

## Supabase dashboard

- Apply repository migrations to the intended project in order.
- Configure the application site URL.
- Allow local, production, and required preview callback URLs.
- Configure Google provider credentials when Google OAuth is enabled.
- Confirm password recovery returns to `/reset-password`.
- Verify the `project-photos` bucket and its object policies.
- Confirm deployed RLS policies match the migration history.

The local `supabase/config.toml` identifies the linked project used by the
repository. Treat changes to that link as environment-sensitive.

## Priority: production email delivery

**Top MVP priority:** purchase a permanent Field Core domain, verify its DNS in
Resend, and configure Resend as the custom SMTP provider for Supabase Auth.
Complete this before inviting real pilot users so invitations, account
verification, magic links, and password recovery are not constrained by the
Supabase development email service limits.

The Resend Marketplace installation has been selected but cannot be provisioned
until a domain controlled by the project owner is available.

## Installable web app

The deployment must serve `manifest.webmanifest`, `sw.js`, the application icon,
favicon, and other public assets from the site root. HTTPS is required for normal
service-worker behavior outside localhost.

## Sites metadata

The repository also contains `.openai/hosting.json` and `.openai/README.md` for
Sites packaging. TanStack/Nitro writes browser assets to `.output/public`; the
documented Sites packaging flow mirrors public assets into `dist/client` while
preserving server output.

## Release checklist

1. Review the complete working-tree diff and migration order.
2. Run `pnpm lint`.
3. Run `pnpm build`.
4. Confirm environment variables exist in the correct deployment scopes.
5. Confirm auth, OAuth, and password-recovery redirect URLs.
6. Verify RLS and storage behavior with users from different workspaces.
7. Exercise owner, admin, manager, field, contractor, viewer, and blocked states.
8. Verify sign-in, onboarding, project, task, progress, note, and photo flows.
9. Check the application on a small mobile viewport and desktop.
10. Confirm no secrets, local `.env` files, build output, or tool state are tracked.

## Rollback considerations

Application deployments can be rolled back independently, but database migrations
are forward-only by project convention. Prepare corrective migrations rather than
editing applied history. Avoid deploying application code that requires a schema
change before that schema is safely available.
