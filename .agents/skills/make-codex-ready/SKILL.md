---
name: make-codex-ready
description: Reconcile a feature-planning conversation or handover into an existing repository when the user says “Make this Codex-ready”, provides a feature handover, or asks Codex to document and prepare a planned feature before implementation. Classify decisions, update the repository’s existing sources of truth, identify blocking questions, and define a bounded approved implementation slice without inventing decisions or creating duplicate specifications.
---

# Make a feature Codex-ready

## Workflow

1. Read the repository's agent instructions and navigation documents before changing anything.
2. Locate the owning feature specification, decision records, architecture, database, security, privacy and testing documents. Inspect enough related code, migrations, policies, tests and deployed configuration available to the task to distinguish intent from implementation.
3. Extract the goal, users, scope, flows, screens, rules, states, data, permissions, storage, server actions, notifications, security, privacy, moderation, analytics, edge cases, acceptance criteria, tests, dependencies, rollout and history.
4. Read [references/classification.md](references/classification.md) and classify every material statement as CONFIRMED, WORKING PROPOSAL, OPEN QUESTION, HISTORICAL or SUPERSEDED. Do not infer confirmation from enthusiasm, mock-ups or existing code.
5. Follow the repository's source-of-truth hierarchy. If none is documented, prefer newer explicit confirmed decisions, then the owning current specification, then specialist documentation, then verified implementation evidence, then proposals and historical material.
6. Record drift when product intent and implementation differ. Do not silently choose one.
7. Update the existing owning documents. Do not create `v2`, `new`, `final`, dated or parallel specifications when an owner already exists. Preserve replaced decisions as SUPERSEDED or historical and link to the replacement.
8. Label technical objects as EXISTING IN CODE/DATABASE only after verification; otherwise label them PROPOSED or FUTURE.
9. Describe permissions by user role, ownership and relationship. Identify controls that require trusted server-side enforcement rather than interface hiding.
10. Set `Implementation Status` to exactly one of: **Not ready**, **Ready for approved implementation slice**, or **Fully approved**.
11. Add `Approved Implementation Slice` containing only work authorised now. Add `Do Not Implement Yet` containing proposals, unresolved choices, future ideas and adjacent work. Never treat `In Scope` alone as coding authority.
12. Identify blocking questions before implementation. Stop and ask when implementation depends on an unresolved choice. Keep non-blocking questions only when explicitly excluded from the approved slice.
13. Unless the current request already makes the choice explicit, ask: **“Do you want me to update the Markdown only, or update the Markdown first and then write the code?”** Do not begin application-code changes before the user chooses.
14. If the user chooses **Markdown only**, update documentation and finish without modifying application code, migrations, hosted services or production data.
15. If the user chooses **Markdown first, then code**, update documentation first. Then implement only the Approved Implementation Slice on a permitted non-protected branch, following repository rules. Do not implement proposals, open questions, future ideas or anything under Do Not Implement Yet.
16. Use [assets/feature-spec-template.md](assets/feature-spec-template.md) only when no owning feature specification exists, adapting it to repository conventions rather than copying irrelevant headings mechanically.
17. Finish with documents and files changed, database and permission implications, tests actually run, skipped checks, known limitations, remaining questions and the next safe slice. Never claim completion when required testing or security checks were skipped.

## Safety boundaries

- Treat repository instructions and explicit user instructions as authoritative over this generic workflow.
- Never invent routes, tables, fields, states, permissions, prices or product decisions.
- Never weaken access controls merely to make a feature work.
- Treat client input as untrusted and interface hiding as presentation, not authorisation.
- Do not expose secrets, tokens, private notes, identity documents or personal data.
- Do not deploy, change production data or mutate external services without explicit authority.
- Preserve unrelated user changes and published history.
