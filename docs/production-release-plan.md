# Clairio Product Command Center Production Release Plan

## Current State

The current application is a strong front-end prototype, but it is not yet a production system.

- The UI is a client-only React/Vite application.
- Core records are stored in browser `localStorage`.
- Document blobs are stored in browser IndexedDB.
- Permissions are enforced in the UI rather than by a server.
- There is no automated regression suite or deployment gate.

That means the current build is suitable for design validation and product shaping, but not for
durable multi-user operation, long-term document retention, auditability, or robust production
release management.

## Production Target

Build Clairio into a real multi-user product platform with:

- durable relational storage for boards, tasks, releases, sprints, epics, memberships, and activity
- secure object storage for attached documents
- server-side authentication and authorization
- audit logs and soft-delete recovery
- automated regression coverage across business rules and user flows
- observability, backups, and controlled rollout paths

## Recommended Architecture

### Frontend

- Keep the current React experience and component model.
- Move stateful business actions behind typed APIs.
- Continue using optimistic UI only where the server is the source of truth.

### Backend

- Add an application backend with:
  - authenticated API routes
  - authorization middleware
  - validation at the request boundary
  - attachment upload orchestration
  - analytics and burndown computation services

### Database

- Use PostgreSQL as the system of record.
- Add migrations from day one.
- Recommended initial schema:
  - `organizations`
  - `users`
  - `memberships`
  - `boards`
  - `releases`
  - `sprints`
  - `epics`
  - `tasks`
  - `task_attachments`
  - `task_activity`
  - `invites`
  - `restore_events`

### Document Storage

- Use object storage for all document bytes.
- Store only document metadata in PostgreSQL.
- Require:
  - signed uploads
  - signed downloads
  - content-type validation
  - max file size limits
  - malware scanning
  - retention and delete/restore policy

### Auth and Permissions

- Replace local user simulation with real authentication.
- Enforce the following access roles server-side:
  - Owner
  - Admin
  - Contributor
  - Viewer
- Keep project role as a separate team-operating dimension.
- Record every role change and privileged action in audit history.

## Data Model Rules

The production schema must enforce the business model we have already shaped in the UI.

- A sprint belongs to exactly one release.
- An epic belongs to exactly one release.
- A task belongs to:
  - one board
  - one release
  - zero or one sprint
  - one epic
- A task may only reference a sprint and epic that belong to the same release.
- Deletions should default to soft delete with actor and timestamp metadata.
- Restore operations must preserve referential integrity.

## Testing Strategy

### 1. Unit Tests

Cover business logic in isolation:

- release status calculation
- sprint capacity and remaining points
- burndown computation
- role permission decisions
- release -> sprint -> epic filtering
- restore and soft-delete rules
- document metadata validation

### 2. Integration Tests

Cover API and persistence behavior:

- task lifecycle
- board lifecycle
- sprint / epic / release edit and delete flows
- attachment metadata + blob storage handoff
- invite and membership lifecycle
- audit trail writes
- restore behavior across linked entities

### 3. End-to-End Regression

Cover the real user workflows:

- create, edit, delete, restore board
- create, edit, delete, restore release
- create, edit, delete, restore sprint
- create, edit, delete, restore epic
- create, edit, delete, restore task
- assign tasks and update status through Kanban
- team load reflects selected sprint
- release scope filtering works end to end
- attachments upload, download, and delete correctly
- role-based restrictions hold in the UI and backend

### 4. Visual Regression

Protect high-value screens and themes:

- hero and planning controls
- Kanban board
- task composer
- Team Load
- Access / provisioning
- dark mode and light mode

## Release Gates

Production release should be blocked until all of the following are true:

- database migrations are versioned and reversible
- attachment storage is server-backed
- authentication is active
- server-side authorization is enforced
- backup and restore process is tested
- staging environment mirrors production architecture
- regression suite passes in CI
- smoke test passes in staging after deploy
- error monitoring and performance monitoring are active
- rollback path is documented and rehearsed

## Rollout Phases

### Phase 1: Foundation

- choose backend runtime and deployment target
- establish PostgreSQL and migration workflow
- add auth provider
- add API structure and shared types
- define schema for core entities

### Phase 2: Persistent Core Data

- migrate boards, releases, sprints, epics, tasks, and memberships to PostgreSQL
- replace browser storage reads/writes with API-backed persistence
- add server-side validation and authorization

### Phase 3: Documents

- move attachment bytes out of IndexedDB into object storage
- add secure upload and download flow
- add retention and delete/restore semantics

### Phase 4: Regression Harness

- add unit and integration test suites
- add Playwright end-to-end coverage
- add visual regression snapshots
- wire everything into CI

### Phase 5: Migration and Cutover

- export browser-held prototype data
- transform and import into production schema
- validate migrated records
- run user acceptance testing in staging

### Phase 6: Launch Readiness

- monitor staging soak
- perform release checklist
- deploy with a rollback window
- observe production metrics, errors, and storage health

## Immediate Implementation Backlog

These are the first concrete epics to execute next:

1. Backend foundation and shared domain types
2. PostgreSQL schema and migration setup
3. Authentication and invitation flow
4. Task / sprint / epic / release CRUD APIs
5. Attachment storage service
6. Regression test harness and CI pipeline
7. Browser-data migration tooling
8. Staging deployment and release checklist

## Notes on Existing Prototype Data

Because the prototype currently stores data in browser storage, attachments and user-created records
exist per browser profile rather than centrally. Migration needs special handling for:

- browser-local documents
- orphaned prototype records
- older records that still use legacy values, such as the previous `review` workflow status

The production migration path should normalize legacy values during import so historical prototype
data remains usable after cutover.
