# Clairio Product Command Center

A net-new Clairio product command center for keeping roadmap work visible, owned, estimated, and moving through an Agile product development team.

## What It Does

- Captures product work with assignee, type, priority, status, due date, acceptance criteria, and notes.
- Uses Fibonacci story points: `0, 1, 2, 3, 5, 8, 13, 21`.
- Shows Agile Kanban lanes: Backlog, Ready, In Progress, Testing, Blocked, and Done.
- Creates Trello-style workspace boards with title, workspace, visibility, template, background, and preview.
- Supports task creation, editing, deleting, lane movement, and drag-and-drop between lanes.
- Tracks work by sprint, epic, and release.
- Creates new sprints, epics, and releases from the planning views.
- Displays sprint commitment, completed points, remaining points, capacity, and blocked points.
- Includes release burndown and epic burndown charts.
- Shows team workload by assignee and sprint capacity.
- Provisions workspace members with invited, active, suspended, and deactivated states.
- Models organization access roles: Owner, Admin, Product Lead, Scrum Master, Contributor, Stakeholder, and External.
- Separates access roles from Scrum roles such as Product Owner, Engineer, Designer, QA / Release, and Observer.
- Demonstrates permission-aware UI for roadmap editing, work movement, deletion, and user administration.
- Filters by search text, priority, and assignee.
- Persists board, task, member, sprint, epic, and release data in localStorage.
- Opens specific workspace views with hash links, including `/#access` for user provisioning.

## Production Hardening

This repository currently ships as a client-only prototype. The production release blueprint covering
real database storage, document storage, authentication, regression testing, migration, and rollout
lives in [`docs/production-release-plan.md`](./docs/production-release-plan.md).

## Local Development

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5173/`.

## Backend Foundation

Phase 1 production scaffolding now lives in this repo:

- shared domain contracts: `src/shared/domain.ts`
- PostgreSQL schema: `prisma/schema.prisma`
- API foundation: `server/src`

To prepare the backend locally:

```bash
cp .env.example .env
npm run db:generate
npm run server:dev
```

The API foundation starts on `http://127.0.0.1:4000/` by default and exposes:

- `GET /health`
- `GET /api/meta/domain`

When a Postgres instance is available, run:

```bash
npm run db:migrate:dev
```

## Verification

```bash
npm run build
```

The app was also checked with headless Chrome at `http://127.0.0.1:5173/`.
