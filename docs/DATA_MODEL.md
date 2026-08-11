# Data model

Supabase Postgres is the system of record. The authoritative schema history is
in `supabase/migrations/`; `src/integrations/supabase/types.ts` is the generated
TypeScript representation of the current database contract.

## Tables

| Table                            | Purpose                                    | Important relationships                               |
| -------------------------------- | ------------------------------------------ | ----------------------------------------------------- |
| `profiles`                       | User identity and application profile      | `id` corresponds to the authenticated user            |
| `user_roles`                     | Platform-level role assignments            | Links a user to an app role                           |
| `workspaces`                     | Business/workspace details                 | Parent of members, projects, invitations, and logs    |
| `workspace_members`              | User membership, role, and status          | Links users to workspaces                             |
| `workspace_invitations`          | Tokenized invitations and acceptance state | Belongs to a workspace and records inviter/acceptor   |
| `workspace_audit_log`            | Immutable-style workspace event history    | Belongs to a workspace; may identify actor and target |
| `projects`                       | Customer job and delivery metadata         | Belongs to a workspace and creator                    |
| `project_members`                | Project assignments                        | Links a project, workspace, and user                  |
| `project_tasks`                  | Actionable project work                    | Belongs to project/workspace; optional assignee       |
| `project_notes`                  | Project text notes                         | Belongs to project/workspace and author               |
| `project_activity`               | Project event stream                       | Belongs to project/workspace; optional actor          |
| `project_photos`                 | Photo metadata                             | Belongs to project/workspace and uploader             |
| `project_progress_updates`       | Dated field progress records               | Belongs to project/workspace and author               |
| `project_progress_update_photos` | Progress-to-photo join                     | Links an update to a photo                            |
| `project_progress_update_tasks`  | Progress-to-task join                      | Links an update to a task                             |
| `project_progress_corrections`   | Append-only correction notes               | Belongs to a progress update, project, and workspace  |

## Enum values

| Enum                | Values                                                                                                                 |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `app_role`          | `admin`, `moderator`, `user`                                                                                           |
| `workspace_role`    | `owner`, `admin`, `project_manager`, `field_worker`, `contractor`, `viewer`                                            |
| `membership_status` | `active`, `suspended`, `removed`                                                                                       |
| `invitation_status` | `pending`, `accepted`, `cancelled`, `expired`                                                                          |
| `project_status`    | `enquiry`, `quote_required`, `quote_sent`, `approved`, `scheduled`, `in_progress`, `waiting`, `completed`, `cancelled` |
| `task_status`       | `todo`, `in_progress`, `blocked`, `completed`                                                                          |
| `task_priority`     | `low`, `normal`, `high`, `urgent`                                                                                      |
| `photo_category`    | `before`, `during`, `after`, `issue`, `materials`, `receipt`, `other`                                                  |

## Key record contents

Projects include customer name, email, phone, job address, description, start
date, expected completion date, status, creator, and timestamps. Tasks include
assignee, priority, status, due date, completion metadata, and timestamps. Photos
include storage path, file metadata, category, caption, taken time, and uploader.
Progress records include work date, summary, issues, author, timestamps, and lock
state.

## Database functions and triggers

Migrations define database functions for operations that must be atomic or
permission-aware, including workspace creation, invitations, membership changes,
project assignment, access checks, and role lookup. Triggers maintain timestamps,
create and synchronize profiles, protect sensitive fields, validate relationship
consistency, assign each project creator to the new project, and write
audit/activity events.

Profile visibility uses a security-definer access helper to avoid recursive RLS
evaluation. It permits an active viewer to read profiles belonging to the same
workspace while preserving isolation from users in other workspaces.

Use the migration files for exact signatures and enforcement logic; generated
types list the callable RPC contract available to the application.

## Storage

Project image binaries are stored in the `project-photos` Supabase Storage bucket.
`project_photos` stores their application metadata. Object policies validate
project access and write authority separately from table RLS.

## Migration rules

- Add forward-only migrations; do not rewrite a migration already applied.
- Review RLS policies, grants, indexes, triggers, and storage policies together.
- Regenerate `src/integrations/supabase/types.ts` after schema changes.
- Keep workspace and project identifiers consistent across child records.
- Treat role or access helper changes as security changes.
