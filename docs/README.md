# Field Core documentation

This directory documents the implementation currently present in the repository.
It is descriptive, not a roadmap. When documentation and executable artifacts
disagree, source code, migrations, and generated database types are authoritative.

## Start here

| Document | Contents |
| --- | --- |
| [Product](PRODUCT.md) | Purpose, users, capabilities, terminology, and current limits |
| [Features](FEATURES.md) | Implemented user flows and feature behavior |
| [Architecture](ARCHITECTURE.md) | Runtime shape, repository map, and system boundaries |
| [Routes](ROUTES.md) | Public, authenticated, admin, redirect, and error routes |
| [Data model](DATA_MODEL.md) | Tables, enums, relationships, storage, and migrations |
| [Security](SECURITY.md) | Authentication, authorization, RLS, roles, and secrets |
| [Development](DEVELOPMENT.md) | Local setup, commands, conventions, and validation |
| [Deployment](DEPLOYMENT.md) | Vercel, Supabase, Sites metadata, and release checklist |

## Other project guidance

- The root `README.md` is the concise project entry point.
- The root `AGENTS.md` contains instructions for Codex and other coding agents.
- `src/routes/README.md` contains TanStack Router filename conventions.

## Maintenance rule

Update the relevant document when a change affects product behavior, routes,
database structure, permissions, environment variables, development commands, or
deployment requirements. Avoid recording planned features as implemented.
