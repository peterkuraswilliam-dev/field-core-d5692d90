# Product

## Summary

Field Core, currently branded as Contractor OS in application metadata, is a
mobile-first workspace for contractors to coordinate projects, teams, tasks,
daily progress, photos, notes, and operational activity.

## Product principles

- Mobile-first, touch-friendly operation for field use.
- A premium dark navy and warm gold visual language.
- Workspace isolation and role-based access.
- Project information gathered in one operational record.
- Clear loading, empty, success, blocked, and error states.

## User types

The workspace role model contains:

| Role | Intended scope in the current implementation |
| --- | --- |
| Owner | Full workspace management, including all lower roles |
| Admin | Workspace-wide access and management of non-owner roles |
| Project Manager | Project creation and project-level management |
| Field Worker | Field participation, including permitted project updates |
| Contractor | Project participation and field contribution |
| Viewer | Read-oriented access to assigned or visible work |

The application also has a separate platform-level role model: `admin`,
`moderator`, and `user`. The admin route checks this platform-level access; it is
not the same as a workspace `admin` role.

## Core concepts

- A **profile** represents an authenticated person.
- A **workspace** represents a contracting business or operating team.
- A **workspace membership** connects a person to a workspace with a role and
  membership status.
- A **project** represents a customer job and may be assigned to selected members.
- A **task** is actionable project work with status, priority, due date, and an
  optional assignee.
- A **progress update** is a dated field record that can reference photos and tasks.
- A **photo** is a categorized project image stored in Supabase Storage.
- A **note** is a text record attached to a project.
- **Activity** and **audit logs** record project and workspace events.

## Current capability boundary

Implemented areas include authentication, onboarding, protected navigation,
workspace and team management, invitations, projects, tasks, progress, photos,
notes, activity, settings, and platform administration.

The repository does not currently define an automated test suite. Calendar and
some navigation destinations may still be placeholders; their presence in the
mobile shell should not be interpreted as a completed feature.

## Naming note

The repository and documentation use **Field Core**, while HTML titles, PWA
metadata, and visible strings currently use **Contractor OS**. Treat this as an
existing naming difference until a product-wide rename is explicitly requested.
