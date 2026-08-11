# Features

## Authentication and account recovery

- Email/password sign-in and account creation use Supabase Auth.
- Google sign-in is initiated through Supabase OAuth.
- Authenticated users are redirected away from the sign-in screen.
- Password reset requests and new-password completion have dedicated routes.
- New-user profile creation and auth-to-profile synchronization are backed by
  database triggers.

## Onboarding and membership state

After authentication, the app loads the user's workspace memberships:

- No membership redirects to workspace onboarding.
- An active membership loads the workspace application.
- Only suspended or removed memberships redirect to the blocked screen.
- Onboarding creates a workspace and owner membership through a database function.

The current client selects the earliest active membership when a user has more
than one; there is no workspace switcher documented in the current UI.

## Control Centre

The Control Centre is the signed-in operational dashboard. It composes workspace,
project, team, progress, photo, and task information into role-aware summaries
and shortcuts.

## Workspaces and teams

- Owners and admins can invite permitted roles.
- Invitation flows support preview, acceptance, resend, cancellation, expiry,
  and an optional message.
- Owners can manage every non-owner role.
- Admins can manage project managers, field workers, contractors, and viewers.
- Membership status supports active, suspended, and removed states.
- Workspace changes and team actions are captured in an audit log.
- Workspace settings expose the editable business details allowed by the current UI.

## Projects

- Owners, admins, and project managers can create projects.
- Projects store customer contact details, job address, description, dates, and status.
- Project status moves through enquiry, quoting, approval, scheduling, execution,
  waiting, completion, or cancellation.
- Owners and admins have workspace-wide project visibility; other roles depend on
  project assignment and database policy.
- Project membership can be managed by authorized roles.

## Tasks

- Project tasks support title, description, assignee, due date, priority, and status.
- Priorities are low, normal, high, and urgent.
- Statuses are to do, in progress, blocked, and completed.
- Managers can create and delete tasks; database policy also permits appropriate
  task updates by an assignee.
- Completion metadata records who completed a task and when.

## Daily progress

- Progress updates record a work date, summary, optional issues, author, and lock time.
- Updates can link to project photos and tasks.
- Corrections can be appended to preserve a record after an update is locked.
- Workspace and project dashboard statistics summarize recent progress.

## Photos

- Photos can be captured or uploaded from the mobile workflow.
- Browser-side images are compressed before upload where supported.
- Accepted categories are before, during, after, issue, materials, receipt, and other.
- Photos store caption, file metadata, capture time, uploader, and storage path.
- Upload access is role-aware and object access is also governed by Supabase Storage
  policies.
- The application remembers recently opened projects to streamline camera routing.

## Notes and activity

- Accessible project members can add notes.
- Authors or managers can edit and delete notes according to policy.
- Project changes, assignments, tasks, notes, and photos produce activity records.
- Activity can be loaded at project or workspace scope.

## Installable application behavior

The public assets include a web app manifest, service worker, application icon,
theme colors, and install UI. The manifest uses standalone display mode and the
current Contractor OS name.

## Platform administration

A nested admin route checks the separate platform-level role system. Non-admin
users are redirected to the Control Centre.
