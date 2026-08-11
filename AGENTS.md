# Field Core agent guide

## Product context

Field Core is a mobile-first contractor project-management application. It uses
TanStack Start, React, TypeScript, Tailwind CSS, and Supabase. Preserve the dark
navy and warm gold visual language and prioritize clear, touch-friendly flows.

Read `README.md` for setup and `docs/README.md` for the documentation index.
Read `docs/ARCHITECTURE.md` before making structural changes.

## Working agreements

- Use `pnpm`; the repository pins pnpm 11 and Node.js 24.
- Preserve existing user changes. Check `git status` and relevant diffs before
  editing, and do not revert unrelated work.
- Make the smallest coherent change that satisfies the request. Do not replace
  working code or add dependencies without a concrete need.
- Keep secrets out of source control and output. Use `.env.example` for variable
  names only; never expose `SUPABASE_SERVICE_ROLE_KEY` to browser code or give it
  a `VITE_` prefix.
- Treat authentication, authorization, workspace membership, invitations,
  storage policies, and Row Level Security as security-sensitive.
- Preserve mobile behavior and accessibility when changing UI.

## Repository conventions

- Routes live in `src/routes/` and follow TanStack Router file-based routing.
  Read `src/routes/README.md` before adding or moving a route.
- `src/routeTree.gen.ts` is generated. Never edit it by hand.
- Supabase access belongs in `src/integrations/supabase/`; feature-level data
  operations live in `src/lib/`.
- Reusable primitives live in `src/components/ui/`; feature components live in
  `src/components/` or an appropriate feature subdirectory.
- Database changes are forward-only migrations in `supabase/migrations/`. Do
  not rewrite an applied migration. Review RLS policies and grants with every
  schema change.
- `src/integrations/supabase/types.ts` represents generated database types.
  Regenerate it after schema changes instead of manually maintaining it.
- Do not commit build output, local tool state, credentials, or `.env` files.

## Validation

Run checks appropriate to the change:

- `pnpm lint` for source or configuration changes.
- `pnpm build` for changes that can affect compilation, routing, SSR, or the
  production bundle.
- Manually exercise affected authentication and permission states when relevant.

There is currently no automated test script. Do not claim tests passed unless a
test command exists and was run. Report skipped checks and the reason.

## Review priorities

Prioritize findings that could cause:

1. Cross-workspace or cross-user data access.
2. Authentication, redirect, invitation, or role-escalation failures.
3. Exposure of server credentials or private storage objects.
4. Data loss, destructive migrations, or broken offline/mobile flows.
5. SSR/client divergence, inaccessible controls, or regressions on small screens.

## Feature handover workflow

When the user says **“Make this Codex-ready”**, provides a feature-planning
handover, or asks Codex to prepare a feature for implementation, use
`.agents/skills/make-codex-ready/SKILL.md`.

Unless the current request already makes the choice explicit, ask whether the
user wants:

1. **Markdown only**, or
2. **Markdown first, then code**.

Do not modify application code before that choice is made. In both cases,
reconcile and update the existing documentation first.

Classify material statements as **CONFIRMED**, **WORKING PROPOSAL**,
**OPEN QUESTION**, **HISTORICAL**, or **SUPERSEDED**. Do not invent missing
decisions or treat mock-ups and existing code as automatic evidence of product
approval.

Set an explicit `Implementation Status` and record both
`Approved Implementation Slice` and `Do Not Implement Yet`. `In Scope` does not
by itself authorise implementation.

Only implement work explicitly included in the approved slice. Do not implement
proposals, unresolved questions, future ideas, or anything listed under
`Do Not Implement Yet`.

Update existing owning documents rather than creating duplicate `v2`, `new`,
`final`, or dated specifications.
