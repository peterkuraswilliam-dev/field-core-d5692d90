# Testing

Field Core currently has no automated test command. Source changes are validated
with ESLint and a production build, while authentication and permission changes
also require manual acceptance testing against the intended Supabase and Vercel
environments.

Do not record passwords, service-role keys, invitation tokens, authentication
links, or identifiable temporary account details in this document.

## Production acceptance baseline

The following checks passed against the stable production deployment on
11 August 2026:

| Area                | Verified behavior                                                                                                                                              |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public application  | Sign-in, password recovery, password completion, and invalid-invitation states load without hydration or browser console errors.                               |
| Route protection    | Signed-out visitors are redirected from workspace, project, team, blocked, and admin routes to sign-in.                                                        |
| Workspace isolation | Users cannot read projects belonging to another workspace.                                                                                                     |
| Project creation    | Admin and project-manager creation were exercised; the project manager is automatically assigned to the created project.                                       |
| Project visibility  | Project managers and field users see assigned projects only; a field user assigned to one project cannot see an unassigned project.                            |
| Task permissions    | Admin and assigned-project-manager task creation succeeds; field, contractor, and viewer task creation is denied.                                              |
| Membership state    | A suspended workspace member is routed to `/blocked`; restored active membership regains normal access.                                                        |
| Invitations         | An admin can create an invitation, the invited email and role preview correctly, acceptance creates an active member, and the accepted member appears on Team. |
| Invitation return   | A validated invitation parameter returns a signed-in user to `/accept-invite`; the email-verification callback still needs a Resend-backed test.               |
| Teammate identity   | Members in the same workspace see teammate names and emails; unrelated workspace profiles remain protected.                                                    |
| Runtime health      | The tested flows produced no browser console errors or grouped Vercel runtime errors.                                                                          |

## Production email limitation

Supabase's development email service can rate-limit account verification, magic
links, invitations, and password recovery. The application presents a clear
retry/admin-help message, but reliable real-user delivery remains blocked on the
top deployment priority: purchase a permanent domain, verify it with Resend, and
configure Resend as Supabase custom SMTP.

## Remaining release checks

- Complete a fresh invitation and password-reset flow through Resend after the
  sending domain and SMTP connection are configured.
- Exercise the principal flows at small iPhone and Android viewport sizes,
  including camera/photo permissions where a real device is required.
- Repeat the permission matrix before a pilot whenever auth, membership, project
  access, storage policy, or security-definer database logic changes.
- Run a small real-user pilot only after production email delivery is verified.
