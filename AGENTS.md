# Feature handover workflow

When the user says **“Make this Codex-ready”**, provides a feature-planning handover, or asks Codex to prepare a feature for implementation, use `.agents/skills/make-codex-ready/SKILL.md`.

Unless the current request already makes the choice explicit, ask whether the user wants:

1. **Markdown only**, or
2. **Markdown first, then code**.

Do not modify application code before that choice is made. In both cases, reconcile and update the existing documentation first.

Classify material statements as **CONFIRMED**, **WORKING PROPOSAL**, **OPEN QUESTION**, **HISTORICAL**, or **SUPERSEDED**. Do not invent missing decisions or treat mock-ups and existing code as automatic evidence of product approval.

Set an explicit `Implementation Status` and record both `Approved Implementation Slice` and `Do Not Implement Yet`. `In Scope` does not by itself authorise implementation.

Only implement work explicitly included in the approved slice. Do not implement proposals, unresolved questions, future ideas, or anything listed under `Do Not Implement Yet`.

Update existing owning documents rather than creating duplicate `v2`, `new`, `final`, or dated specifications.
