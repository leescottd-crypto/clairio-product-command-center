import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  Building2,
  CalendarDays,
  ChevronDown,
  Check,
  CirclePlus,
  ClipboardList,
  Download,
  FileText,
  Flag,
  KeyRound,
  Layers3,
  MailPlus,
  Moon,
  Paperclip,
  Pencil,
  Save,
  Search,
  ShieldCheck,
  Sun,
  Target,
  Trash2,
  Undo2,
  UploadCloud,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { createPortal } from "react-dom";
import { ChangeEvent, DragEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  deleteAttachmentBlob,
  getAttachmentBlob,
  saveAttachmentBlob,
} from "./attachmentStore";
import {
  accessRoleValues,
  scrumRoleValues,
  storyPointValues,
} from "./shared/domain";
import type {
  BoardDraft,
  BoardTemplate,
  BoardVisibility,
  DeletedMeta,
  Epic,
  EpicDraft,
  InviteDraft,
  MemberStatus,
  Priority,
  ProductTask,
  Release,
  ReleaseDraft,
  ScrumRole,
  Sprint,
  SprintDraft,
  SprintMemberCapacities,
  StoryPoints,
  SystemRole,
  TaskAttachment,
  TaskDraft,
  TaskStatus,
  TaskType,
  WorkspaceBoard,
  WorkspaceMember,
} from "./shared/domain";

type ViewMode = "board" | "sprint" | "epics" | "releases" | "reports" | "team" | "access";
type ThemeMode = "light" | "dark";

type PendingAttachment = TaskAttachment & {
  file: File;
};

type BurndownPoint = {
  date: string;
  ideal: number;
  actual: number;
};

type ReleaseSprintReportRow = {
  sprintId: string;
  sprintName: string;
  startDate: string;
  endDate: string;
  startingBacklog: number;
  addedInSprint: number;
  completedInSprint: number;
  remainingAfterSprint: number;
  scopeAtEnd: number;
  unestimatedRemainingCount: number;
};

type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

const STORAGE_KEY = "clairio-product-task-manager:agile:v1";
const BOARDS_STORAGE_KEY = "clairio-product-task-manager:boards:v1";
const MEMBERS_STORAGE_KEY = "clairio-product-task-manager:members:v1";
const RELEASES_STORAGE_KEY = "clairio-product-task-manager:releases:v1";
const EPICS_STORAGE_KEY = "clairio-product-task-manager:epics:v1";
const SPRINTS_STORAGE_KEY = "clairio-product-task-manager:sprints:v1";
const THEME_STORAGE_KEY = "clairio-product-task-manager:theme:v1";
const LEGACY_STORAGE_KEY = "clairio-product-task-manager:v1";
const ALL_EPICS_ID = "all";
const viewModes: ViewMode[] = ["board", "sprint", "epics", "releases", "reports", "team", "access"];
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const roleLabels: Record<SystemRole, string> = {
  owner: "Owner",
  admin: "Admin",
  contributor: "Contributor",
  viewer: "Viewer",
};

const scrumRoleLabels: Record<ScrumRole, string> = {
  product_owner: "Product Owner",
  scrum_master: "Scrum Master",
  engineer: "Engineer",
  designer: "Designer",
  qa_release: "QA / Release",
  stakeholder: "Stakeholder",
  observer: "Observer",
};

const statusLabels: Record<MemberStatus, string> = {
  invited: "Invited",
  active: "Active",
  suspended: "Suspended",
  deactivated: "Deactivated",
};

const rolePermissions: Record<SystemRole, string[]> = {
  owner: [
    "Manage billing, security, roles, and data export",
    "Create and delete boards, releases, sprints, and epics",
    "Add, edit, move, delete, and restore product tasks",
  ],
  admin: [
    "Invite, activate, suspend, and edit members",
    "Configure teams, capacity, and workspace defaults",
    "Create and delete boards, releases, sprints, and epics",
    "Add, edit, move, delete, and restore product tasks",
  ],
  contributor: [
    "Add, edit, move, delete, and restore product tasks",
    "Estimate with Fibonacci points and update delivery status",
    "View sprint, epic, release, and team dashboards",
  ],
  viewer: [
    "View roadmap, release progress, and burndown health",
    "Review Kanban, sprint, epic, release, and team dashboards",
    "No create, edit, move, delete, or provisioning access",
  ],
};

const seedMembers: WorkspaceMember[] = [
  {
    id: "avery",
    name: "Avery Chen",
    email: "avery@clairio.example",
    role: "Product Manager",
    systemRole: "contributor",
    scrumRole: "product_owner",
    status: "active",
    team: "Core Product",
    capacity: 12,
    accent: "#e06c47",
    invitedOn: "2026-04-15",
    lastActive: "2026-04-15",
  },
  {
    id: "maya",
    name: "Maya Patel",
    email: "maya@clairio.example",
    role: "UX Research",
    systemRole: "contributor",
    scrumRole: "designer",
    status: "active",
    team: "Discovery",
    capacity: 8,
    accent: "#7c5b72",
    invitedOn: "2026-04-15",
    lastActive: "2026-04-15",
  },
  {
    id: "scott",
    name: "Scott Lee",
    email: "scott@clairio.example",
    role: "Engineering Lead",
    systemRole: "owner",
    scrumRole: "engineer",
    status: "active",
    team: "Core Product",
    capacity: 16,
    accent: "#668fa3",
    invitedOn: "2026-04-15",
    lastActive: "2026-04-15",
  },
  {
    id: "claire",
    name: "Claire Ops",
    email: "claire@clairio.example",
    role: "QA / Release",
    systemRole: "admin",
    scrumRole: "qa_release",
    status: "active",
    team: "Release",
    capacity: 10,
    accent: "#6f8a5d",
    invitedOn: "2026-04-15",
    lastActive: "2026-04-15",
  },
];

const seedReleases: Release[] = [
  {
    id: "r-2026-04",
    name: "April Operating Layer",
    goal: "Demo-ready task intake, assignment, and roadmap reporting.",
    startDate: "2026-04-15",
    endDate: "2026-04-30",
  },
  {
    id: "r-2026-05",
    name: "May Team Planning",
    goal: "Multi-team planning rituals, release tracking, and richer analytics.",
    startDate: "2026-05-01",
    endDate: "2026-05-29",
  },
];

const legacyDemoSprintIds = new Set(["sprint-8", "sprint-9"]);
const seedSprints: Sprint[] = [];

const seedEpics: Epic[] = [
  {
    id: "epic-intake",
    name: "AI Intake & Triage",
    ownerId: "avery",
    releaseId: "r-2026-04",
    goal: "Turn scattered requests into clarified product backlog items.",
  },
  {
    id: "epic-roadmap",
    name: "Roadmap Health",
    ownerId: "scott",
    releaseId: "r-2026-04",
    goal: "Show momentum, blockers, and decision debt without manual reporting.",
  },
  {
    id: "epic-memory",
    name: "Customer Memory",
    ownerId: "maya",
    releaseId: "r-2026-05",
    goal: "Connect product tasks to customer context and call evidence.",
  },
];

const lanes: Array<{ id: TaskStatus; label: string; helper: string; wip?: number }> = [
  { id: "backlog", label: "Backlog", helper: "Ordered product backlog" },
  { id: "ready", label: "Ready", helper: "Refined and estimated", wip: 8 },
  { id: "progress", label: "In Progress", helper: "Active team work", wip: 4 },
  { id: "testing", label: "Testing", helper: "QA and product validation", wip: 3 },
  { id: "blocked", label: "Blocked", helper: "Needs help now", wip: 2 },
  { id: "done", label: "Done", helper: "Meets definition of done" },
];

const priorityLabels: Record<Priority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

const typeLabels: Record<TaskType, string> = {
  story: "Story",
  bug: "Bug",
  chore: "Chore",
  spike: "Spike",
  debt: "Tech Debt",
};

const visibilityLabels: Record<BoardVisibility, string> = {
  private: "Private",
  workspace: "Workspace",
  organization: "Organization",
  public: "Public",
};

const templateLabels: Record<BoardTemplate, string> = {
  blank: "Blank board",
  kanban: "Kanban delivery",
  scrum: "Scrum sprint",
  release: "Release readiness",
};

const APP_NAME = "Clairio Product Command Center";
const APP_SUPPORT_COPY =
  "Coordinate backlog, sprint execution, and release signal from one delivery intelligence layer.";
const LEGACY_APP_DESCRIPTION = "Sprint planning, Kanban flow, and release confidence for the product team.";
const BRAND_LOGO_SRC = "/clairio-logo.png";

const boardBackgrounds = [
  { name: "Clairio Clay", value: "#e06c47" },
  { name: "Roadmap Moss", value: "#6f8a5d" },
  { name: "Signal Sky", value: "#668fa3" },
  { name: "Product Plum", value: "#7c5b72" },
  { name: "Launch Gold", value: "#e4a853" },
];

const laneOptions: SelectOption[] = lanes.map((lane) => ({ value: lane.id, label: lane.label }));
const priorityOptions: SelectOption[] = Object.entries(priorityLabels).map(([value, label]) => ({
  value,
  label,
}));
const taskTypeOptions: SelectOption[] = Object.entries(typeLabels).map(([value, label]) => ({
  value,
  label,
}));
const visibilityOptions: SelectOption[] = Object.entries(visibilityLabels).map(([value, label]) => ({
  value,
  label,
}));
const templateOptions: SelectOption[] = Object.entries(templateLabels).map(([value, label]) => ({
  value,
  label,
}));
const accessRoleOptions: SelectOption[] = Object.entries(roleLabels).map(([value, label]) => ({
  value,
  label,
}));
const projectRoleOptions: SelectOption[] = Object.entries(scrumRoleLabels).map(([value, label]) => ({
  value,
  label,
}));
const fibonacciOptions: SelectOption[] = storyPointValues.map((point) => ({
  value: String(point),
  label: `${point} ${point === 21 ? "(split)" : "pts"}`,
}));
const boardBackgroundOptions: SelectOption[] = boardBackgrounds.map((background) => ({
  value: background.value,
  label: background.name,
}));

const seedBoards: WorkspaceBoard[] = [
  {
    id: "board-product-ops",
    title: "Clairio Product Ops",
    workspace: "Clairio Product",
    visibility: "workspace",
    background: "#e06c47",
    template: "scrum",
    description: "",
    createdOn: "2026-04-15",
    starred: true,
  },
];

const seedTasks: ProductTask[] = [
  {
    id: "task-1",
    boardId: "board-product-ops",
    title: "Define assistant-assisted triage loop",
    assigneeId: "avery",
    type: "story",
    status: "progress",
    priority: "critical",
    points: 8,
    epicId: "epic-intake",
    releaseId: "r-2026-04",
    sprintId: "",
    dueDate: "2026-04-22",
    completedOn: "",
    acceptance:
      "Given a new product request, when it is captured, then the team can see owner, estimate, epic, release, and next decision.",
    notes:
      "Clarify how incoming requests become product tasks, who approves the next action, and what Clairio should summarize.",
    attachments: [],
  },
  {
    id: "task-2",
    boardId: "board-product-ops",
    title: "Map task metadata from customer calls",
    assigneeId: "maya",
    type: "spike",
    status: "testing",
    priority: "high",
    points: 5,
    epicId: "epic-memory",
    releaseId: "r-2026-05",
    sprintId: "",
    dueDate: "2026-04-19",
    completedOn: "",
    acceptance:
      "Given three customer call summaries, when the mapping is validated in testing, then the team has a recommended metadata checklist.",
    notes:
      "Identify the fields Clairio should capture automatically for follow-up product work.",
    attachments: [],
  },
  {
    id: "task-3",
    boardId: "board-product-ops",
    title: "Create roadmap health signals",
    assigneeId: "scott",
    type: "story",
    status: "ready",
    priority: "medium",
    points: 5,
    epicId: "epic-roadmap",
    releaseId: "r-2026-04",
    sprintId: "",
    dueDate: "2026-04-25",
    completedOn: "",
    acceptance:
      "Given active product work, when leadership opens the board, then they can see open points, blocked points, and decision load.",
    notes:
      "Add signals for aging work, critical open tasks, and testing load so leadership can see where decisions are stuck.",
    attachments: [],
  },
  {
    id: "task-4",
    boardId: "board-product-ops",
    title: "Ship demo-ready task board shell",
    assigneeId: "claire",
    type: "chore",
    status: "done",
    priority: "high",
    points: 3,
    epicId: "epic-roadmap",
    releaseId: "r-2026-04",
    sprintId: "",
    dueDate: "2026-04-15",
    completedOn: "2026-04-15",
    acceptance:
      "Given a local browser session, when the app opens, then the product task board renders with persisted demo data.",
    notes:
      "Polished first screen with persistent tasks, board movement, and a clear operating rhythm for product work.",
    attachments: [],
  },
  {
    id: "task-5",
    boardId: "board-product-ops",
    title: "Add release burndown reporting",
    assigneeId: "scott",
    type: "story",
    status: "backlog",
    priority: "high",
    points: 8,
    epicId: "epic-roadmap",
    releaseId: "r-2026-04",
    sprintId: "",
    dueDate: "2026-04-29",
    completedOn: "",
    acceptance:
      "Given a release with estimated stories, when the release dashboard is viewed, then ideal and actual remaining points are visible.",
    notes:
      "Use story points as the burndown unit and separate unestimated work from committed scope.",
    attachments: [],
  },
  {
    id: "task-6",
    boardId: "board-product-ops",
    title: "Resolve NetSuite context import blocker",
    assigneeId: "claire",
    type: "bug",
    status: "blocked",
    priority: "critical",
    points: 3,
    epicId: "epic-memory",
    releaseId: "r-2026-05",
    sprintId: "",
    dueDate: "2026-04-20",
    completedOn: "",
    acceptance:
      "Given a failed context import, when the source data is retried, then the task links to the correct customer evidence.",
    notes:
      "Blocked on sample export. Needs source data before implementation can continue.",
    attachments: [],
  },
];

const emptyDraft: TaskDraft = {
  boardId: "board-product-ops",
  title: "",
  assigneeId: "avery",
  type: "story",
  status: "backlog",
  priority: "medium",
  points: 3,
  epicId: "epic-intake",
  releaseId: "r-2026-04",
  sprintId: "",
  dueDate: "",
  acceptance: "",
  notes: "",
  attachments: [],
};

const emptyBoardDraft: BoardDraft = {
  title: "",
  workspace: "Clairio Product",
  visibility: "workspace",
  background: "#e06c47",
  template: "scrum",
  description: "",
};

const emptyInviteDraft: InviteDraft = {
  name: "",
  email: "",
  role: "Product teammate",
  systemRole: "contributor",
  scrumRole: "engineer",
  team: "Core Product",
  capacity: 8,
};

const emptyReleaseDraft: ReleaseDraft = {
  name: "",
  goal: "",
  startDate: "2026-04-15",
  endDate: "2026-04-30",
};

const emptyEpicDraft: EpicDraft = {
  name: "",
  ownerId: "avery",
  releaseId: "r-2026-04",
  goal: "",
};

const emptySprintDraft: SprintDraft = {
  name: "",
  goal: "",
  releaseId: "r-2026-04",
  startDate: "2026-04-15",
  endDate: "2026-04-28",
  capacity: 40,
  memberCapacities: {},
};

function clampCapacity(value: number) {
  return Math.max(0, Math.min(40, value));
}

function buildSprintMemberCapacities(members: WorkspaceMember[]): SprintMemberCapacities {
  return Object.fromEntries(members.map((member) => [member.id, clampCapacity(member.capacity)]));
}

function isSprintMemberCapacities(value: unknown): value is SprintMemberCapacities {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  return Object.values(value).every((points) => typeof points === "number" && Number.isFinite(points));
}

function inferTaskReleaseStart(releaseId: string) {
  return seedReleases.find((release) => release.id === releaseId)?.startDate ?? "2026-04-15";
}

function isProductTask(value: unknown): value is ProductTask {
  if (!value || typeof value !== "object") {
    return false;
  }

  const task = value as Partial<ProductTask>;
  return (
    typeof task.id === "string" &&
    typeof task.boardId === "string" &&
    typeof task.title === "string" &&
    typeof task.assigneeId === "string" &&
    typeof task.epicId === "string" &&
    typeof task.releaseId === "string" &&
    typeof task.sprintId === "string"
  );
}

function isTaskAttachment(value: unknown): value is TaskAttachment {
  if (!value || typeof value !== "object") {
    return false;
  }

  const attachment = value as Partial<TaskAttachment>;
  return (
    typeof attachment.id === "string" &&
    typeof attachment.name === "string" &&
    typeof attachment.type === "string" &&
    typeof attachment.size === "number" &&
    typeof attachment.createdAt === "string" &&
    typeof attachment.createdBy === "string"
  );
}

function isWorkspaceMember(value: unknown): value is WorkspaceMember {
  if (!value || typeof value !== "object") {
    return false;
  }

  const member = value as Partial<WorkspaceMember>;
  return (
    typeof member.id === "string" &&
    typeof member.name === "string" &&
    typeof member.email === "string" &&
    typeof member.role === "string" &&
    typeof member.systemRole === "string" &&
    typeof member.scrumRole === "string" &&
    typeof member.status === "string" &&
    typeof member.team === "string" &&
    typeof member.capacity === "number" &&
    typeof member.accent === "string"
  );
}

function loadLegacyMemberCapacities(): SprintMemberCapacities {
  const stored = window.localStorage.getItem(MEMBERS_STORAGE_KEY);
  if (!stored) {
    return buildSprintMemberCapacities(seedMembers);
  }

  try {
    const parsed = JSON.parse(stored) as unknown;
    return Array.isArray(parsed) && parsed.every(isWorkspaceMember)
      ? buildSprintMemberCapacities(parsed)
      : buildSprintMemberCapacities(seedMembers);
  } catch {
    return buildSprintMemberCapacities(seedMembers);
  }
}

function isWorkspaceBoard(value: unknown): value is WorkspaceBoard {
  if (!value || typeof value !== "object") {
    return false;
  }

  const board = value as Partial<WorkspaceBoard>;
  return (
    typeof board.id === "string" &&
    typeof board.title === "string" &&
    typeof board.workspace === "string" &&
    typeof board.visibility === "string" &&
    typeof board.background === "string" &&
    typeof board.template === "string" &&
    typeof board.description === "string" &&
    typeof board.createdOn === "string" &&
    typeof board.starred === "boolean"
  );
}

function isRelease(value: unknown): value is Release {
  if (!value || typeof value !== "object") {
    return false;
  }

  const release = value as Partial<Release>;
  return (
    typeof release.id === "string" &&
    typeof release.name === "string" &&
    typeof release.goal === "string" &&
    typeof release.startDate === "string" &&
    typeof release.endDate === "string"
  );
}

function isEpic(value: unknown): value is Epic {
  if (!value || typeof value !== "object") {
    return false;
  }

  const epic = value as Partial<Epic>;
  return (
    typeof epic.id === "string" &&
    typeof epic.name === "string" &&
    typeof epic.ownerId === "string" &&
    typeof epic.releaseId === "string" &&
    typeof epic.goal === "string"
  );
}

function isSprint(value: unknown): value is Sprint {
  if (!value || typeof value !== "object") {
    return false;
  }

  const sprint = value as Partial<Sprint>;
  return (
    typeof sprint.id === "string" &&
    typeof sprint.name === "string" &&
    typeof sprint.goal === "string" &&
    typeof sprint.startDate === "string" &&
    typeof sprint.endDate === "string" &&
    typeof sprint.capacity === "number" &&
    (sprint.memberCapacities === undefined || isSprintMemberCapacities(sprint.memberCapacities))
  );
}

function inferSprintReleaseId(sprintId: string) {
  if (!sprintId) {
    return seedReleases[0].id;
  }

  try {
    const storedTasks = window.localStorage.getItem(STORAGE_KEY);
    const parsed = storedTasks ? (JSON.parse(storedTasks) as unknown) : [];
    if (!Array.isArray(parsed)) {
      return seedReleases[0].id;
    }

    const matchedTask = parsed.find(
      (task): task is ProductTask =>
        isProductTask(task) &&
        task.sprintId === sprintId &&
        seedReleases.some((release) => release.id === task.releaseId),
    );

    return matchedTask?.releaseId ?? seedReleases[0].id;
  } catch {
    return seedReleases[0].id;
  }
}

function normalizeSprint(sprint: Sprint): Sprint {
  const releaseId =
    typeof sprint.releaseId === "string" && sprint.releaseId
      ? sprint.releaseId
      : inferSprintReleaseId(sprint.id);
  const memberCapacities = isSprintMemberCapacities(sprint.memberCapacities)
    ? Object.fromEntries(
        Object.entries(sprint.memberCapacities).map(([memberId, capacity]) => [
          memberId,
          clampCapacity(capacity),
        ]),
      )
    : loadLegacyMemberCapacities();

  return {
    ...sprint,
    releaseId,
    memberCapacities,
  };
}

function normalizeSystemRole(role: string | undefined): SystemRole {
  if (accessRoleValues.includes(role as SystemRole)) {
    return role as SystemRole;
  }

  if (role === "stakeholder" || role === "external") {
    return "viewer";
  }

  return "contributor";
}

function normalizeScrumRole(role: string | undefined): ScrumRole {
  return scrumRoleValues.includes(role as ScrumRole) ? (role as ScrumRole) : "engineer";
}

function normalizeMember(member: WorkspaceMember): WorkspaceMember {
  return {
    ...member,
    role: member.role.trim() || scrumRoleLabels[normalizeScrumRole(member.scrumRole)],
    systemRole: normalizeSystemRole(member.systemRole),
    scrumRole: normalizeScrumRole(member.scrumRole),
  };
}

function normalizeTask(task: ProductTask): ProductTask {
  const taskWithMeta = task as ProductTask & {
    createdAt?: string;
    updatedAt?: string;
    releaseAddedAt?: string;
  };
  const rawStatus = typeof (task as { status?: string }).status === "string"
    ? (task as { status?: string }).status
    : "backlog";
  const normalizedStatus: TaskStatus =
    rawStatus === "review" ? "testing" : lanes.some((lane) => lane.id === rawStatus)
      ? (rawStatus as TaskStatus)
      : "backlog";
  const createdAt = taskWithMeta.createdAt || task.completedOn || inferTaskReleaseStart(task.releaseId);
  const releaseAddedAt = taskWithMeta.releaseAddedAt || createdAt;
  const updatedAt = taskWithMeta.updatedAt || createdAt;

  return {
    ...task,
    status: normalizedStatus,
    createdAt,
    updatedAt,
    releaseAddedAt,
    attachments: Array.isArray(task.attachments)
      ? task.attachments.filter(isTaskAttachment)
      : [],
  };
}

function isActiveRecord<T extends DeletedMeta>(item: T) {
  return !item.deletedAt;
}

function isDeletedRecord<T extends DeletedMeta>(item: T) {
  return Boolean(item.deletedAt);
}

function markDeleted<T extends DeletedMeta>(item: T, userId: string): T {
  return { ...item, deletedAt: new Date().toISOString(), deletedBy: userId };
}

function restoreDeleted<T extends DeletedMeta>(item: T): T {
  const { deletedAt: _deletedAt, deletedBy: _deletedBy, ...rest } = item;
  return rest as T;
}

function removeLegacySprintAssignments(task: ProductTask): ProductTask {
  const normalizedTask = normalizeTask(task);
  return legacyDemoSprintIds.has(normalizedTask.sprintId)
    ? { ...normalizedTask, sprintId: "" }
    : normalizedTask;
}

function removeLegacyDemoSprints(sprints: Sprint[]) {
  return sprints.filter((sprint) => !legacyDemoSprintIds.has(sprint.id));
}

function loadTasks(): ProductTask[] {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    return seedTasks.map(removeLegacySprintAssignments);
  }

  try {
    const parsed = JSON.parse(stored) as unknown;
    return Array.isArray(parsed) && parsed.every(isProductTask) && parsed.length > 0
      ? parsed.map(removeLegacySprintAssignments)
      : seedTasks.map(removeLegacySprintAssignments);
  } catch {
    return seedTasks.map(removeLegacySprintAssignments);
  }
}

function loadMembers(): WorkspaceMember[] {
  const stored = window.localStorage.getItem(MEMBERS_STORAGE_KEY);
  if (!stored) {
    return seedMembers;
  }

  try {
    const parsed = JSON.parse(stored) as unknown;
    return Array.isArray(parsed) && parsed.every(isWorkspaceMember) && parsed.length > 0
      ? parsed.map(normalizeMember)
      : seedMembers;
  } catch {
    return seedMembers;
  }
}

function loadBoards(): WorkspaceBoard[] {
  const stored = window.localStorage.getItem(BOARDS_STORAGE_KEY);
  if (!stored) {
    return seedBoards;
  }

  try {
    const parsed = JSON.parse(stored) as unknown;
    return Array.isArray(parsed) && parsed.every(isWorkspaceBoard) && parsed.length > 0
      ? parsed
      : seedBoards;
  } catch {
    return seedBoards;
  }
}

function loadReleases(): Release[] {
  const stored = window.localStorage.getItem(RELEASES_STORAGE_KEY);
  if (!stored) {
    return seedReleases;
  }

  try {
    const parsed = JSON.parse(stored) as unknown;
    return Array.isArray(parsed) && parsed.every(isRelease) && parsed.length > 0
      ? parsed
      : seedReleases;
  } catch {
    return seedReleases;
  }
}

function loadEpics(): Epic[] {
  const stored = window.localStorage.getItem(EPICS_STORAGE_KEY);
  if (!stored) {
    return seedEpics;
  }

  try {
    const parsed = JSON.parse(stored) as unknown;
    return Array.isArray(parsed) && parsed.every(isEpic) && parsed.length > 0
      ? parsed
      : seedEpics;
  } catch {
    return seedEpics;
  }
}

function loadSprints(): Sprint[] {
  const stored = window.localStorage.getItem(SPRINTS_STORAGE_KEY);
  if (!stored) {
    return seedSprints.map(normalizeSprint);
  }

  try {
    const parsed = JSON.parse(stored) as unknown;
    return Array.isArray(parsed) && parsed.every(isSprint)
      ? removeLegacyDemoSprints(parsed.map(normalizeSprint))
      : seedSprints.map(normalizeSprint);
  } catch {
    return seedSprints.map(normalizeSprint);
  }
}

function loadThemeMode(): ThemeMode {
  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (storedTheme === "light" || storedTheme === "dark") {
    return storedTheme;
  }

  return "dark";
}

function loadViewMode(): ViewMode {
  const hashView = window.location.hash.replace("#", "");
  return viewModes.includes(hashView as ViewMode) ? (hashView as ViewMode) : "board";
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatFileSize(size: number) {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${Math.round(size / 1024)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function attachmentTypeLabel(attachment: TaskAttachment) {
  if (attachment.type) {
    return attachment.type.split("/").pop()?.toUpperCase() ?? "FILE";
  }

  const extension = attachment.name.split(".").pop();
  return extension ? extension.toUpperCase() : "FILE";
}

function parseDate(value: string) {
  return new Date(`${value}T00:00:00`);
}

function daysBetween(startDate: string, endDate: string) {
  const start = parseDate(startDate).getTime();
  const end = parseDate(endDate).getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  const count = Math.max(1, Math.round((end - start) / dayMs) + 1);

  return Array.from({ length: count }, (_, index) => {
    const date = new Date(start + index * dayMs);
    return formatDate(date);
  });
}

function getMember(members: WorkspaceMember[], id: string) {
  return members.find((member) => member.id === id) ?? members[0] ?? seedMembers[0];
}

function getBoard(boards: WorkspaceBoard[], id: string) {
  return boards.find((board) => board.id === id) ?? boards[0] ?? seedBoards[0];
}

function getEpic(epics: Epic[], id: string) {
  return epics.find((epic) => epic.id === id) ?? epics[0] ?? seedEpics[0];
}

function getRelease(releases: Release[], id: string) {
  return releases.find((release) => release.id === id) ?? releases[0] ?? seedReleases[0];
}

function getSprint(sprints: Sprint[], id: string) {
  return sprints.find((sprint) => sprint.id === id) ?? sprints[0] ?? null;
}

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function sumPoints(tasks: ProductTask[]) {
  return tasks.reduce((sum, task) => sum + task.points, 0);
}

function completedPoints(tasks: ProductTask[]) {
  return sumPoints(tasks.filter((task) => task.status === "done"));
}

function remainingPoints(tasks: ProductTask[]) {
  return Math.max(0, sumPoints(tasks) - completedPoints(tasks));
}

function canManageUsers(role: SystemRole) {
  return role === "owner" || role === "admin";
}

function canManageRoadmap(role: SystemRole) {
  return role === "owner" || role === "admin";
}

function canManageTasks(role: SystemRole) {
  return role !== "viewer";
}

function accentForIndex(index: number) {
  const accents = ["#e06c47", "#7c5b72", "#668fa3", "#6f8a5d", "#e4a853", "#3f6f73"];
  return accents[index % accents.length];
}

function calculateBurndown(
  tasks: ProductTask[],
  startDate: string,
  endDate: string,
): BurndownPoint[] {
  const dates = daysBetween(startDate, endDate);
  const total = sumPoints(tasks);
  const lastIndex = Math.max(1, dates.length - 1);

  return dates.map((date, index) => {
    const completedThroughDate = tasks
      .filter((task) => task.completedOn && task.completedOn <= date)
      .reduce((sum, task) => sum + task.points, 0);

    return {
      date,
      ideal: Math.max(0, Math.round(total - (total * index) / lastIndex)),
      actual: Math.max(0, total - completedThroughDate),
    };
  });
}

function buildReleaseSprintReportRows(
  tasks: ProductTask[],
  sprints: Sprint[],
): ReleaseSprintReportRow[] {
  const orderedSprints = [...sprints].sort((left, right) =>
    left.startDate.localeCompare(right.startDate),
  );

  return orderedSprints.map((sprint) => {
    const taskAddedOn = (task: ProductTask) => (task.releaseAddedAt ?? "").slice(0, 10);
    const taskCompletedOn = (task: ProductTask) => (task.completedOn ?? "").slice(0, 10);
    const startingBacklog = tasks
      .filter(
        (task) =>
          taskAddedOn(task) < sprint.startDate &&
          (!task.completedOn || taskCompletedOn(task) >= sprint.startDate),
      )
      .reduce((total, task) => total + task.points, 0);
    const addedInSprint = tasks
      .filter(
        (task) =>
          Boolean(task.releaseAddedAt) &&
          taskAddedOn(task) >= sprint.startDate &&
          taskAddedOn(task) <= sprint.endDate,
      )
      .reduce((total, task) => total + task.points, 0);
    const completedInSprint = tasks
      .filter(
        (task) =>
          Boolean(task.completedOn) &&
          taskCompletedOn(task) >= sprint.startDate &&
          taskCompletedOn(task) <= sprint.endDate,
      )
      .reduce((total, task) => total + task.points, 0);
    const remainingTasks = tasks.filter(
      (task) =>
        taskAddedOn(task) <= sprint.endDate &&
        (!task.completedOn || taskCompletedOn(task) > sprint.endDate),
    );

    return {
      sprintId: sprint.id,
      sprintName: sprint.name,
      startDate: sprint.startDate,
      endDate: sprint.endDate,
      startingBacklog,
      addedInSprint,
      completedInSprint,
      remainingAfterSprint: remainingTasks.reduce((total, task) => total + task.points, 0),
      scopeAtEnd: tasks
        .filter((task) => taskAddedOn(task) <= sprint.endDate)
        .reduce((total, task) => total + task.points, 0),
      unestimatedRemainingCount: remainingTasks.filter((task) => task.points === 0).length,
    };
  });
}

function SelectField({
  value,
  options,
  onChange,
  disabled = false,
  ariaLabel,
  size = "default",
}: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  ariaLabel?: string;
  size?: "default" | "small";
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const selectedOption =
    options.find((option) => option.value === value) ??
    options.find((option) => !option.disabled) ??
    options[0] ??
    null;
  const isDisabled = disabled || options.length === 0 || options.every((option) => option.disabled);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const updatePosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) {
        return;
      }

      const rect = trigger.getBoundingClientRect();
      const estimatedMenuHeight = Math.min(320, options.length * 44 + 14);
      const spaceBelow = window.innerHeight - rect.bottom - 12;
      const spaceAbove = rect.top - 12;
      const shouldOpenAbove = spaceBelow < Math.min(estimatedMenuHeight, 220) && spaceAbove > spaceBelow;
      const maxHeight = Math.max(160, shouldOpenAbove ? spaceAbove : spaceBelow);
      const top = shouldOpenAbove
        ? Math.max(12, rect.top - Math.min(estimatedMenuHeight, maxHeight) - 8)
        : rect.bottom + 8;
      const left = Math.min(rect.left, window.innerWidth - rect.width - 12);

      setMenuPosition({
        top,
        left: Math.max(12, left),
        width: rect.width,
        maxHeight,
      });
    };

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setIsOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, options]);

  useEffect(() => {
    setIsOpen(false);
  }, [value]);

  const triggerClassName = [
    "select-field-trigger",
    size === "small" ? "select-field-trigger-small" : "",
    isOpen ? "is-open" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <div className="select-field">
        <button
          ref={triggerRef}
          className={triggerClassName}
          type="button"
          aria-label={ariaLabel}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          disabled={isDisabled}
          onClick={() => setIsOpen((current) => !current)}
        >
          <span className="select-field-value">{selectedOption?.label ?? "Select"}</span>
          <ChevronDown size={16} className="select-field-chevron" aria-hidden="true" />
        </button>
      </div>
      {isOpen && menuPosition && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              className="select-field-menu"
              role="listbox"
              aria-label={ariaLabel}
              style={{
                top: menuPosition.top,
                left: menuPosition.left,
                width: menuPosition.width,
                maxHeight: menuPosition.maxHeight,
              }}
            >
              {options.map((option) => {
                const isSelected = option.value === value;

                return (
                  <button
                    key={option.value || option.label}
                    type="button"
                    role="option"
                    className={["select-field-option", isSelected ? "is-selected" : ""]
                      .filter(Boolean)
                      .join(" ")}
                    aria-selected={isSelected}
                    disabled={option.disabled}
                    onClick={() => {
                      if (option.disabled) {
                        return;
                      }
                      onChange(option.value);
                      setIsOpen(false);
                      triggerRef.current?.focus();
                    }}
                  >
                    <span>{option.label}</span>
                    {isSelected ? <Check size={16} aria-hidden="true" /> : null}
                  </button>
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="progress-track" aria-label={`${Math.round(value)} percent complete`}>
      <span style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

function TeamLoadBar({
  assigned,
  capacity,
  statusPoints,
}: {
  assigned: number;
  capacity: number;
  statusPoints: Array<{ id: TaskStatus; label: string; points: number }>;
}) {
  const safeAssigned = Math.max(0, assigned);
  const fillPercent =
    safeAssigned === 0 ? 0 : capacity > 0 ? Math.min(100, (safeAssigned / capacity) * 100) : 100;
  const activeSegments = statusPoints.filter((segment) => segment.points > 0);
  const tooltipText =
    safeAssigned === 0
      ? "No assigned work in this sprint."
      : [
          `Assigned ${safeAssigned} pts${capacity > 0 ? ` of ${capacity} capacity` : ""}`,
          ...activeSegments.map((segment) => `${segment.label}: ${segment.points} pts`),
        ].join(" • ");

  return (
    <div
      className="team-load-track"
      aria-label={`${safeAssigned} assigned points across team workflow`}
      title={tooltipText}
    >
      <div className="team-load-fill" style={{ width: `${fillPercent}%` }}>
        {activeSegments.map((segment) => (
          <span
            key={segment.id}
            className={`team-load-segment team-load-segment-${segment.id}`}
            style={{ flexGrow: segment.points }}
            title={`${segment.label}: ${segment.points} pts`}
          />
        ))}
      </div>
    </div>
  );
}

function goalItems(goal: string): string[] {
  return goal
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim().replace(/^\d+[\.\)]\s*/, ""))
    .filter(Boolean);
}

function GoalList({ goal, className = "" }: { goal: string; className?: string }) {
  const items = goalItems(goal);
  if (items.length === 0) {
    return null;
  }

  return (
    <ol className={["goal-list", className].filter(Boolean).join(" ")}>
      {items.map((item, index) => (
        <li key={`${item}-${index}`}>{item}</li>
      ))}
    </ol>
  );
}

function createDarkLogoVariant(source: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (typeof document === "undefined") {
      reject(new Error("Document is not available."));
      return;
    }

    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;

      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("Canvas context is not available."));
        return;
      }

      context.drawImage(image, 0, 0);
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const { data } = imageData;

      for (let index = 0; index < data.length; index += 4) {
        const alpha = data[index + 3];
        if (alpha === 0) {
          continue;
        }

        const red = data[index];
        const green = data[index + 1];
        const blue = data[index + 2];
        const maxChannel = Math.max(red, green, blue);
        const minChannel = Math.min(red, green, blue);
        const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
        const isNearBlack = maxChannel < 74 || (luminance < 88 && maxChannel - minChannel < 34);

        if (!isNearBlack) {
          continue;
        }

        data[index] = 247;
        data[index + 1] = 240;
        data[index + 2] = 229;
      }

      context.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };

    image.onerror = () => reject(new Error("Unable to load logo image."));
    image.src = source;
  });
}

function BurndownChart({
  title,
  subtitle,
  points,
  className = "",
}: {
  title: string;
  subtitle: string;
  points: BurndownPoint[];
  className?: string;
}) {
  const width = 420;
  const height = 180;
  const padding = 26;
  const maxValue = Math.max(1, ...points.flatMap((point) => [point.ideal, point.actual]));
  const denominator = Math.max(1, points.length - 1);

  const toPoint = (value: number, index: number) => {
    const x = padding + (index / denominator) * (width - padding * 2);
    const y = height - padding - (value / maxValue) * (height - padding * 2);
    return `${x},${y}`;
  };

  const idealPath = points.map((point, index) => toPoint(point.ideal, index)).join(" ");
  const actualPath = points.map((point, index) => toPoint(point.actual, index)).join(" ");

  return (
    <article className={["chart-card", className].filter(Boolean).join(" ")}>
      <div className="chart-heading">
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
        <span>{points[points.length - 1]?.actual ?? 0} pts left</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${title} burndown chart`}>
        <line x1={padding} x2={width - padding} y1={height - padding} y2={height - padding} />
        <line x1={padding} x2={padding} y1={padding} y2={height - padding} />
        <polyline className="ideal-line" points={idealPath} />
        <polyline className="actual-line" points={actualPath} />
        {points.map((point, index) => (
          <circle
            key={`${point.date}-${point.actual}`}
            className="actual-dot"
            cx={toPoint(point.actual, index).split(",")[0]}
            cy={toPoint(point.actual, index).split(",")[1]}
            r="3"
          />
        ))}
      </svg>
      <div className="chart-legend">
        <span><i className="legend-actual" />Actual</span>
        <span><i className="legend-ideal" />Ideal</span>
      </div>
    </article>
  );
}

function ReleaseScopeChart({
  title,
  subtitle,
  rows,
  className = "",
}: {
  title: string;
  subtitle: string;
  rows: ReleaseSprintReportRow[];
  className?: string;
}) {
  const width = 420;
  const height = 180;
  const padding = 26;
  const maxValue = Math.max(
    1,
    ...rows.flatMap((row) => [row.scopeAtEnd, row.remainingAfterSprint, row.completedInSprint]),
  );
  const denominator = Math.max(1, rows.length - 1);

  const toPoint = (value: number, index: number) => {
    const x = padding + (index / denominator) * (width - padding * 2);
    const y = height - padding - (value / maxValue) * (height - padding * 2);
    return `${x},${y}`;
  };

  const scopePath = rows.map((row, index) => toPoint(row.scopeAtEnd, index)).join(" ");
  const remainingPath = rows.map((row, index) => toPoint(row.remainingAfterSprint, index)).join(" ");

  return (
    <article className={["chart-card", className].filter(Boolean).join(" ")}>
      <div className="chart-heading">
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
        <span>{rows[rows.length - 1]?.remainingAfterSprint ?? 0} pts remaining</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${title} scope chart`}>
        <line x1={padding} x2={width - padding} y1={height - padding} y2={height - padding} />
        <line x1={padding} x2={padding} y1={padding} y2={height - padding} />
        <polyline className="scope-line" points={scopePath} />
        <polyline className="actual-line" points={remainingPath} />
        {rows.map((row, index) => (
          <circle
            key={`${row.sprintId}-${row.remainingAfterSprint}`}
            className="actual-dot"
            cx={toPoint(row.remainingAfterSprint, index).split(",")[0]}
            cy={toPoint(row.remainingAfterSprint, index).split(",")[1]}
            r="3"
          />
        ))}
      </svg>
      <div className="chart-legend">
        <span><i className="legend-actual" />Remaining</span>
        <span><i className="legend-scope" />Scope</span>
      </div>
    </article>
  );
}

function ReleaseSprintBarsChart({
  title,
  subtitle,
  rows,
  className = "",
}: {
  title: string;
  subtitle: string;
  rows: ReleaseSprintReportRow[];
  className?: string;
}) {
  const maxValue = Math.max(1, ...rows.map((row) => Math.max(row.scopeAtEnd, row.startingBacklog + row.addedInSprint)));

  return (
    <article className={["chart-card", className].filter(Boolean).join(" ")}>
      <div className="chart-heading">
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
        <span>{rows.length} sprint{rows.length === 1 ? "" : "s"}</span>
      </div>
      <div className="release-sprint-bars" role="img" aria-label={`${title} stacked sprint bars`}>
        {rows.map((row) => {
          const baseRemaining = Math.max(0, row.scopeAtEnd - row.addedInSprint - row.completedInSprint);
          const completedPercent = (row.completedInSprint / maxValue) * 100;
          const carryPercent = (baseRemaining / maxValue) * 100;
          const addedPercent = (row.addedInSprint / maxValue) * 100;

          return (
            <div className="release-sprint-bar-row" key={row.sprintId}>
              <div className="release-sprint-bar-meta">
                <strong>{row.sprintName}</strong>
                <span>{row.startDate} to {row.endDate}</span>
              </div>
              <div className="release-sprint-bar-track">
                <span
                  className="release-sprint-bar-segment release-sprint-bar-completed"
                  style={{ width: `${completedPercent}%` }}
                />
                <span
                  className="release-sprint-bar-segment release-sprint-bar-carry"
                  style={{ width: `${carryPercent}%` }}
                />
                <span
                  className="release-sprint-bar-segment release-sprint-bar-added"
                  style={{ width: `${addedPercent}%` }}
                />
              </div>
              <div className="release-sprint-bar-stats">
                <span>{row.completedInSprint} done</span>
                <span>{row.addedInSprint} added</span>
                <span>{row.remainingAfterSprint} left</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="chart-legend">
        <span><i className="legend-completed-sprint" />Completed</span>
        <span><i className="legend-carry-sprint" />Carryover</span>
        <span><i className="legend-added-sprint" />Added in sprint</span>
      </div>
    </article>
  );
}

function App() {
  const [tasks, setTasks] = useState<ProductTask[]>(loadTasks);
  const [boards, setBoards] = useState<WorkspaceBoard[]>(loadBoards);
  const [members, setMembers] = useState<WorkspaceMember[]>(loadMembers);
  const [releases, setReleases] = useState<Release[]>(loadReleases);
  const [epics, setEpics] = useState<Epic[]>(loadEpics);
  const [sprints, setSprints] = useState<Sprint[]>(loadSprints);
  const [boardDraft, setBoardDraft] = useState<BoardDraft>(emptyBoardDraft);
  const [inviteDraft, setInviteDraft] = useState<InviteDraft>(emptyInviteDraft);
  const [releaseDraft, setReleaseDraft] = useState<ReleaseDraft>(emptyReleaseDraft);
  const [epicDraft, setEpicDraft] = useState<EpicDraft>(emptyEpicDraft);
  const [sprintDraft, setSprintDraft] = useState<SprintDraft>(emptySprintDraft);
  const [draft, setDraft] = useState<TaskDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingReleaseId, setEditingReleaseId] = useState<string | null>(null);
  const [editingEpicId, setEditingEpicId] = useState<string | null>(null);
  const [editingSprintId, setEditingSprintId] = useState<string | null>(null);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [removedAttachmentIds, setRemovedAttachmentIds] = useState<string[]>([]);
  const [attachmentError, setAttachmentError] = useState("");
  const [attachmentInputKey, setAttachmentInputKey] = useState(0);
  const [confirmingTaskDelete, setConfirmingTaskDelete] = useState(false);
  const [showTaskComposer, setShowTaskComposer] = useState(false);
  const [showBoardCreator, setShowBoardCreator] = useState(false);
  const [query, setQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<Priority | "all">("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [viewMode, setViewMode] = useState<ViewMode>(loadViewMode);
  const [activeBoardId, setActiveBoardId] = useState(seedBoards[0].id);
  const [activeReleaseId, setActiveReleaseId] = useState(seedReleases[0].id);
  const [activeEpicId, setActiveEpicId] = useState(ALL_EPICS_ID);
  const [activeSprintId, setActiveSprintId] = useState("");
  const [prefersReleaseScope, setPrefersReleaseScope] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>(loadThemeMode);
  const [darkBrandLogoSrc, setDarkBrandLogoSrc] = useState("");
  const [provisioningNotice, setProvisioningNotice] = useState("");

  const activeBoards = useMemo(() => boards.filter(isActiveRecord), [boards]);
  const deletedBoards = useMemo(() => boards.filter(isDeletedRecord), [boards]);
  const activeReleases = useMemo(() => releases.filter(isActiveRecord), [releases]);
  const deletedReleases = useMemo(() => releases.filter(isDeletedRecord), [releases]);
  const activeEpics = useMemo(() => epics.filter(isActiveRecord), [epics]);
  const deletedEpics = useMemo(() => epics.filter(isDeletedRecord), [epics]);
  const activeSprints = useMemo(() => sprints.filter(isActiveRecord), [sprints]);
  const deletedSprints = useMemo(() => sprints.filter(isDeletedRecord), [sprints]);
  const activeTasks = useMemo(() => tasks.filter(isActiveRecord), [tasks]);
  const deletedTasks = useMemo(() => tasks.filter(isDeletedRecord), [tasks]);
  const activeBoard = getBoard(activeBoards, activeBoardId);
  const activeRelease = getRelease(activeReleases, activeReleaseId);
  const releaseSprints = useMemo(
    () => activeSprints.filter((sprint) => sprint.releaseId === activeRelease.id),
    [activeRelease.id, activeSprints],
  );
  const releaseEpics = useMemo(
    () => activeEpics.filter((epic) => epic.releaseId === activeRelease.id),
    [activeEpics, activeRelease.id],
  );
  const draftReleaseId = activeReleases.some((release) => release.id === draft.releaseId)
    ? draft.releaseId
    : activeRelease.id;
  const draftReleaseSprints = useMemo(
    () => activeSprints.filter((sprint) => sprint.releaseId === draftReleaseId),
    [activeSprints, draftReleaseId],
  );
  const draftReleaseEpics = useMemo(
    () => activeEpics.filter((epic) => epic.releaseId === draftReleaseId),
    [activeEpics, draftReleaseId],
  );
  const activeSprint = getSprint(releaseSprints, activeSprintId);
  const getMemberSprintCapacity = (sprint: Sprint | null, member: WorkspaceMember) =>
    sprint?.memberCapacities[member.id] ?? clampCapacity(member.capacity);
  const selectedEpic =
    activeEpicId === ALL_EPICS_ID
      ? null
      : releaseEpics.find((epic) => epic.id === activeEpicId) ?? null;
  const activeEpicLabel = selectedEpic?.name ?? "All epics";

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    window.localStorage.setItem(BOARDS_STORAGE_KEY, JSON.stringify(boards));
  }, [boards]);

  useEffect(() => {
    window.localStorage.setItem(MEMBERS_STORAGE_KEY, JSON.stringify(members));
  }, [members]);

  useEffect(() => {
    window.localStorage.setItem(RELEASES_STORAGE_KEY, JSON.stringify(releases));
  }, [releases]);

  useEffect(() => {
    window.localStorage.setItem(EPICS_STORAGE_KEY, JSON.stringify(epics));
  }, [epics]);

  useEffect(() => {
    window.localStorage.setItem(SPRINTS_STORAGE_KEY, JSON.stringify(sprints));
  }, [sprints]);

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
    window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  }, [themeMode]);

  useEffect(() => {
    let cancelled = false;

    createDarkLogoVariant(BRAND_LOGO_SRC)
      .then((generatedSrc) => {
        if (!cancelled) {
          setDarkBrandLogoSrc(generatedSrc);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDarkBrandLogoSrc("");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!activeBoards.some((board) => board.id === activeBoardId)) {
      setActiveBoardId(activeBoards[0]?.id ?? boards[0]?.id ?? seedBoards[0].id);
    }
  }, [activeBoardId, activeBoards, boards]);

  useEffect(() => {
    setDraft((current) => ({ ...current, boardId: activeBoardId }));
  }, [activeBoardId]);

  useEffect(() => {
    if (!activeReleases.some((release) => release.id === activeReleaseId)) {
      setActiveReleaseId(activeReleases[0]?.id ?? releases[0]?.id ?? seedReleases[0].id);
    }
  }, [activeReleaseId, activeReleases, releases]);

  useEffect(() => {
    if (activeEpicId !== ALL_EPICS_ID && !releaseEpics.some((epic) => epic.id === activeEpicId)) {
      setActiveEpicId(ALL_EPICS_ID);
    }
  }, [activeEpicId, releaseEpics]);

  useEffect(() => {
    if (activeSprintId && !releaseSprints.some((sprint) => sprint.id === activeSprintId)) {
      setActiveSprintId("");
    }
  }, [activeSprintId, releaseSprints]);

  useEffect(() => {
    if (
      (viewMode === "sprint" || viewMode === "team") &&
      !activeSprintId &&
      !prefersReleaseScope &&
      releaseSprints[0]
    ) {
      setActiveSprintId(releaseSprints[0].id);
    }
  }, [activeSprintId, prefersReleaseScope, releaseSprints, viewMode]);

  const activeMembers = useMemo(
    () => members.filter((member) => member.status === "active"),
    [members],
  );
  const assignableMembers = activeMembers.filter((member) => member.systemRole !== "viewer");
  const taskAssignableMembers = assignableMembers.length > 0 ? assignableMembers : activeMembers;
  const currentUser =
    members.find((member) => member.systemRole === "owner" && member.status !== "deactivated") ??
    members[0] ??
    seedMembers[0];
  const currentPermissions = {
    manageUsers: canManageUsers(currentUser.systemRole),
    manageRoadmap: canManageRoadmap(currentUser.systemRole),
    manageTasks: canManageTasks(currentUser.systemRole),
  };
  const activeBoardDescription = activeBoard.description.trim();
  const visibleBoardDescription =
    activeBoardDescription &&
    activeBoardDescription !== APP_SUPPORT_COPY &&
    activeBoardDescription !== LEGACY_APP_DESCRIPTION
      ? activeBoardDescription
      : "";
  const brandLogoSrc = themeMode === "dark" && darkBrandLogoSrc ? darkBrandLogoSrc : BRAND_LOGO_SRC;
  const boardTasks = useMemo(
    () => activeTasks.filter((task) => task.boardId === activeBoard.id),
    [activeBoard.id, activeTasks],
  );
  const scopedBoardTasks = useMemo(
    () =>
      boardTasks.filter((task) => {
        const matchesRelease = task.releaseId === activeRelease.id;
        const matchesSprint = activeSprint ? task.sprintId === activeSprint.id : true;
        const matchesEpic = selectedEpic ? task.epicId === selectedEpic.id : true;

        return matchesRelease && matchesSprint && matchesEpic;
      }),
    [activeRelease.id, activeSprint, boardTasks, selectedEpic],
  );

  const filteredTasks = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return scopedBoardTasks.filter((task) => {
      const member = getMember(members, task.assigneeId);
      const epic = getEpic(epics, task.epicId);
      const release = getRelease(activeReleases, task.releaseId);
      const matchesQuery =
        normalizedQuery.length === 0 ||
        [
          task.title,
          task.notes,
          task.acceptance,
          member.name,
          epic.name,
          release.name,
          typeLabels[task.type],
          ...task.attachments.map((attachment) => attachment.name),
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      const matchesPriority =
        priorityFilter === "all" || task.priority === priorityFilter;
      const matchesAssignee =
        assigneeFilter === "all" || task.assigneeId === assigneeFilter;

      return matchesQuery && matchesPriority && matchesAssignee;
    });
  }, [activeReleases, assigneeFilter, scopedBoardTasks, epics, members, priorityFilter, query]);
  const filteredTaskPoints = sumPoints(filteredTasks);
  const filteredBlockedCount = filteredTasks.filter((task) => task.status === "blocked").length;
  const filteredReadyCount = filteredTasks.filter((task) => task.status === "ready").length;

  const activeReleaseTasks = boardTasks.filter((task) => task.releaseId === activeRelease.id);
  const sprintTasks = activeSprint
    ? activeReleaseTasks.filter((task) => task.sprintId === activeSprint.id)
    : [];
  const sprintCommitted = sumPoints(sprintTasks);
  const sprintCompleted = completedPoints(sprintTasks);
  const sprintRemaining = Math.max(0, sprintCommitted - sprintCompleted);
  const sprintCompletion = sprintCommitted > 0 ? (sprintCompleted / sprintCommitted) * 100 : 0;

  const activeEpicTasks = selectedEpic
    ? activeReleaseTasks.filter((task) => task.epicId === selectedEpic.id)
    : activeReleaseTasks;
  const activeEpicOwner = selectedEpic ? getMember(members, selectedEpic.ownerId) : null;

  const activeReleaseTotalPoints = sumPoints(activeReleaseTasks);
  const activeReleaseCompletedPoints = completedPoints(activeReleaseTasks);
  const activeReleaseRemainingPoints = Math.max(0, activeReleaseTotalPoints - activeReleaseCompletedPoints);
  const activeReleaseDonePercent =
    activeReleaseTotalPoints > 0
      ? (activeReleaseCompletedPoints / activeReleaseTotalPoints) * 100
      : 0;
  const releaseReportRows = buildReleaseSprintReportRows(activeReleaseTasks, releaseSprints);
  const releaseScopeAddedPoints = releaseReportRows.reduce(
    (total, row) => total + row.addedInSprint,
    0,
  );
  const releaseAverageVelocity =
    releaseReportRows.length > 0
      ? Math.round(
          releaseReportRows.reduce((total, row) => total + row.completedInSprint, 0) /
            releaseReportRows.length,
        )
      : 0;
  const releaseProjectedSprintsRemaining =
    releaseAverageVelocity > 0
      ? Math.ceil(activeReleaseRemainingPoints / releaseAverageVelocity)
      : null;
  const latestReleaseReportRow = releaseReportRows[releaseReportRows.length - 1] ?? null;
  const activeEpicTotalPoints = sumPoints(activeEpicTasks);
  const activeEpicDonePoints = completedPoints(activeEpicTasks);
  const activeEpicRemainingPoints = Math.max(0, activeEpicTotalPoints - activeEpicDonePoints);
  const releaseBurndownPoints = calculateBurndown(
    activeReleaseTasks,
    activeRelease.startDate,
    activeRelease.endDate,
  );
  const todayKey = formatDate(new Date());
  const upcomingWindowEnd = formatDate(new Date(Date.now() + 6 * 24 * 60 * 60 * 1000));
  const filteredDueSoonCount = filteredTasks.filter(
    (task) =>
      Boolean(task.dueDate) &&
      task.status !== "done" &&
      task.dueDate >= todayKey &&
      task.dueDate <= upcomingWindowEnd,
  ).length;
  const todayReleasePoint = releaseBurndownPoints.find((point) => point.date === todayKey) ?? null;
  const idealRemainingToday =
    todayKey <= activeRelease.startDate
      ? activeReleaseTotalPoints
      : todayKey >= activeRelease.endDate
        ? 0
        : todayReleasePoint?.ideal ?? activeReleaseRemainingPoints;
  const releaseCatchUpPoints = Math.max(0, activeReleaseRemainingPoints - idealRemainingToday);
  const releaseAheadPoints = Math.max(0, idealRemainingToday - activeReleaseRemainingPoints);
  const releaseTrackingStatus =
    activeReleaseTotalPoints === 0
      ? "No scope set"
      : releaseCatchUpPoints > 0
        ? "Behind target"
        : releaseAheadPoints > 0
          ? "Ahead of target"
          : "On target";
  const releaseTrackingTone =
    activeReleaseTotalPoints === 0
      ? "ink"
      : releaseCatchUpPoints > 0
        ? "burnt"
        : releaseAheadPoints > 0
          ? "green"
          : "sky";
  const releaseTrackingDetail =
    activeReleaseTotalPoints === 0
      ? "Add scoped work to start release pacing."
      : releaseCatchUpPoints > 0
        ? `Catch up ${releaseCatchUpPoints} pts to get back on pace.`
        : releaseAheadPoints > 0
          ? `${releaseAheadPoints} pts ahead of the ideal line.`
          : `Tracking cleanly to ${activeRelease.endDate}.`;
  const sprintSignalHeadline = activeSprint
    ? `${sprintRemaining} points left`
    : `${activeReleaseRemainingPoints} release points left`;
  const sprintSignalDetail = activeSprint
    ? `${sprintCommitted} pts committed of ${activeSprint.capacity} capacity · ${sprintCompleted} pts done`
    : "Release scope is active until a sprint is selected.";
  const sprintGoalCopy =
    activeSprint?.goal ?? "Set a sprint goal to keep the team aligned on the sprint outcome.";
  const releaseSignalHeadline =
    activeReleaseTotalPoints === 0
      ? "No scoped work yet"
      : releaseCatchUpPoints > 0
        ? `${releaseCatchUpPoints} pts to recover`
        : releaseAheadPoints > 0
        ? `${releaseAheadPoints} pts ahead`
        : `${activeReleaseRemainingPoints} pts left`;
  const releaseProjectionCopy =
    activeReleaseRemainingPoints === 0
      ? "Release scope is complete."
      : releaseProjectedSprintsRemaining
        ? `At the current pace, about ${releaseProjectedSprintsRemaining} more sprint${
            releaseProjectedSprintsRemaining === 1 ? "" : "s"
          } to finish.`
        : "Need at least one completed sprint before we can project release finish pace.";
  const workspaceScopeLabel = activeSprint
    ? `${activeSprint.name} execution scope`
    : `${activeRelease.name} release scope`;
  const workspaceScopeCopy = activeSprint
    ? "Focus the board on sprint execution, delivery risk, and what needs to move next."
    : "Watch release-level flow, blockers, and readiness without leaving the board.";
  const paceSignalValue = activeSprint
    ? `${sprintCommitted}/${activeSprint.capacity}`
    : `${releaseAverageVelocity || 0}`;
  const paceSignalLabel = activeSprint ? "Sprint load" : "Avg velocity";
  const paceSignalDetail = activeSprint
    ? `${Math.max(0, activeSprint.capacity - sprintCommitted)} pts headroom`
    : releaseReportRows.length > 0
      ? "pts completed per sprint"
      : "Need one completed sprint";
  const teamScopeTasks = activeSprint ? sprintTasks : activeReleaseTasks;
  const teamScopeName = activeSprint ? activeSprint.name : `${activeRelease.name} release scope`;
  const teamScopeDetail = activeSprint
    ? `${activeSprint.startDate} to ${activeSprint.endDate}`
    : "Select a sprint to inspect team load against sprint capacity.";
  const teamAssignedTotal = sumPoints(teamScopeTasks);
  const teamDoneTotal = completedPoints(teamScopeTasks);
  const teamRemainingTotal = Math.max(0, teamAssignedTotal - teamDoneTotal);
  const teamCapacityTotal = activeSprint
    ? activeMembers.reduce((total, member) => total + getMemberSprintCapacity(activeSprint, member), 0)
    : 0;
  const teamOverCapacity = Math.max(0, teamAssignedTotal - teamCapacityTotal);

  const metrics = [
    { label: "Sprint committed", value: `${sprintCommitted}`, suffix: "pts", tone: "ink" },
    { label: "Remaining", value: `${sprintRemaining}`, suffix: "pts", tone: "burnt" },
    {
      label: "Release committed",
      value: `${activeReleaseTotalPoints}`,
      suffix: "pts",
      tone: "ink",
    },
    {
      label: "Release remaining",
      value: `${activeReleaseRemainingPoints}`,
      suffix: "pts",
      tone: releaseCatchUpPoints > 0 ? "burnt" : "sky",
    },
    {
      label: "Tracking status",
      value: releaseTrackingStatus,
      suffix: "",
      tone: releaseTrackingTone,
      variant: "text",
      detail: releaseTrackingDetail,
    },
    {
      label: "Catch-up",
      value: `${releaseCatchUpPoints}`,
      suffix: "pts",
      tone: releaseCatchUpPoints > 0 ? "burnt" : "green",
      detail:
        releaseCatchUpPoints > 0
          ? "Needed to return to the ideal burndown line."
          : "No recovery work needed right now.",
    },
  ];

  const selectedTask = editingId
    ? tasks.find((task) => task.id === editingId)
    : null;
  const isTaskComposerOpen = showTaskComposer || Boolean(editingId);

  useEffect(() => {
    if (!isTaskComposerOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        resetForm();
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isTaskComposerOpen]);

  function resetAttachmentState() {
    setPendingAttachments([]);
    setRemovedAttachmentIds([]);
    setAttachmentError("");
    setAttachmentInputKey((current) => current + 1);
  }

  function updateDraft<K extends keyof TaskDraft>(field: K, value: TaskDraft[K]) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function updateBoardDraft<K extends keyof BoardDraft>(field: K, value: BoardDraft[K]) {
    setBoardDraft((current) => ({ ...current, [field]: value }));
  }

  function updateInviteDraft<K extends keyof InviteDraft>(field: K, value: InviteDraft[K]) {
    setInviteDraft((current) => ({ ...current, [field]: value }));
  }

  function updateReleaseDraft<K extends keyof ReleaseDraft>(field: K, value: ReleaseDraft[K]) {
    setReleaseDraft((current) => ({ ...current, [field]: value }));
  }

  function updateEpicDraft<K extends keyof EpicDraft>(field: K, value: EpicDraft[K]) {
    setEpicDraft((current) => ({ ...current, [field]: value }));
  }

  function updateSprintDraft<K extends keyof SprintDraft>(field: K, value: SprintDraft[K]) {
    setSprintDraft((current) => ({ ...current, [field]: value }));
  }

  function firstEpicIdForRelease(releaseId: string) {
    return activeEpics.find((epic) => epic.releaseId === releaseId)?.id ?? "";
  }

  function selectActiveRelease(releaseId: string) {
    setActiveReleaseId(releaseId);
    setActiveSprintId("");
    setPrefersReleaseScope(true);
    setActiveEpicId(ALL_EPICS_ID);
    setDraft((current) => ({
      ...current,
      releaseId,
      sprintId: "",
      epicId: activeEpics.some((epic) => epic.releaseId === releaseId && epic.id === current.epicId)
        ? current.epicId
        : firstEpicIdForRelease(releaseId),
    }));
    setEpicDraft((current) => ({ ...current, releaseId }));
    setSprintDraft((current) => ({ ...current, releaseId }));
  }

  function selectActiveEpic(epicId: string) {
    setActiveEpicId(epicId);
    if (epicId !== ALL_EPICS_ID) {
      setDraft((current) => ({ ...current, epicId }));
    }
  }

  function selectDraftRelease(releaseId: string) {
    const nextEpicId = firstEpicIdForRelease(releaseId);

    setDraft((current) => ({
      ...current,
      releaseId,
      sprintId:
        activeSprints.find((sprint) => sprint.releaseId === releaseId && sprint.id === current.sprintId)
          ?.id ?? "",
      epicId: activeEpics.some((epic) => epic.releaseId === releaseId && epic.id === current.epicId)
        ? current.epicId
        : nextEpicId,
    }));
  }

  function resetForm() {
    setDraft({
      ...emptyDraft,
      boardId: activeBoardId,
      releaseId: activeRelease.id,
      sprintId: activeSprint?.id ?? "",
      epicId: selectedEpic?.id ?? releaseEpics[0]?.id ?? "",
    });
    setConfirmingTaskDelete(false);
    setEditingId(null);
    setShowTaskComposer(false);
    resetAttachmentState();
  }

  function resetBoardForm() {
    setBoardDraft(emptyBoardDraft);
  }

  function resetInviteForm() {
    setInviteDraft(emptyInviteDraft);
  }

  function resetPlanningForms() {
    setReleaseDraft(emptyReleaseDraft);
    setEpicDraft({ ...emptyEpicDraft, releaseId: activeRelease.id });
    setSprintDraft({ ...emptySprintDraft, releaseId: activeRelease.id });
    setEditingReleaseId(null);
    setEditingEpicId(null);
    setEditingSprintId(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentPermissions.manageTasks) {
      return;
    }

    const title = draft.title.trim();
    if (!title) {
      return;
    }

    const normalizedReleaseId = activeReleases.some((release) => release.id === draft.releaseId)
      ? draft.releaseId
      : activeRelease.id;
    const normalizedReleaseEpics = activeEpics.filter((epic) => epic.releaseId === normalizedReleaseId);
    const normalizedReleaseSprints = activeSprints.filter(
      (sprint) => sprint.releaseId === normalizedReleaseId,
    );

    if (normalizedReleaseEpics.length === 0) {
      window.alert("Create an epic in this release before adding tasks.");
      return;
    }

    const normalizedDraft: TaskDraft = {
      ...draft,
      boardId: activeBoards.some((board) => board.id === draft.boardId)
        ? draft.boardId
        : activeBoard.id,
      title,
      acceptance: draft.acceptance.trim(),
      notes: draft.notes.trim(),
      releaseId: normalizedReleaseId,
      epicId: normalizedReleaseEpics.some((epic) => epic.id === draft.epicId)
        ? draft.epicId
        : normalizedReleaseEpics[0]?.id ?? "",
      sprintId: normalizedReleaseSprints.some((sprint) => sprint.id === draft.sprintId)
        ? draft.sprintId
        : "",
      attachments: draft.attachments,
    };
    const today = formatDate(new Date());
    const nowIso = new Date().toISOString();
    const previousTask = editingId
      ? tasks.find((task) => task.id === editingId) ?? null
      : null;
    const releaseAddedAt =
      previousTask && previousTask.releaseId === normalizedDraft.releaseId
        ? previousTask.releaseAddedAt ?? previousTask.createdAt ?? today
        : today;
    const createdAt = previousTask?.createdAt ?? today;
    const completedOn =
      normalizedDraft.status === "done"
        ? previousTask?.completedOn || today
        : "";

    try {
      await Promise.all(
        pendingAttachments.map((attachment) =>
          saveAttachmentBlob({
            id: attachment.id,
            blob: attachment.file,
            name: attachment.name,
            type: attachment.type,
            size: attachment.size,
            updatedAt: new Date().toISOString(),
          }),
        ),
      );
      await Promise.all(removedAttachmentIds.map((attachmentId) => deleteAttachmentBlob(attachmentId)));
    } catch {
      setAttachmentError("Attachment storage failed. Please try adding the file again.");
      return;
    }

    if (editingId) {
      setTasks((current) =>
        current.map((task) =>
          task.id === editingId
            ? {
                ...normalizedDraft,
                id: task.id,
                completedOn,
                createdAt,
                updatedAt: nowIso,
                releaseAddedAt,
              }
            : task,
        ),
      );
    } else {
      setTasks((current) => [
        {
          ...normalizedDraft,
          id: crypto.randomUUID(),
          completedOn,
          createdAt,
          updatedAt: nowIso,
          releaseAddedAt,
        },
        ...current,
      ]);
    }

    resetForm();
  }

  function addFilesToDraft(fileList: FileList | File[]) {
    if (!currentPermissions.manageTasks) {
      return;
    }

    const files = Array.from(fileList);
    if (files.length === 0) {
      return;
    }

    const createdAt = new Date().toISOString();
    const nextAttachments: PendingAttachment[] = files.map((file) => ({
      id: crypto.randomUUID(),
      name: file.name,
      type: file.type || "application/octet-stream",
      size: file.size,
      createdAt,
      createdBy: currentUser.id,
      file,
    }));

    setPendingAttachments((current) => [...current, ...nextAttachments]);
    setDraft((current) => ({
      ...current,
      attachments: [
        ...current.attachments,
        ...nextAttachments.map(({ file: _file, ...attachment }) => attachment),
      ],
    }));
    setAttachmentError("");
  }

  function handleAttachmentInput(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files) {
      addFilesToDraft(event.target.files);
    }
  }

  function handleAttachmentDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    addFilesToDraft(event.dataTransfer.files);
  }

  function removeDraftAttachment(attachmentId: string) {
    const isPending = pendingAttachments.some((attachment) => attachment.id === attachmentId);

    setDraft((current) => ({
      ...current,
      attachments: current.attachments.filter((attachment) => attachment.id !== attachmentId),
    }));
    setPendingAttachments((current) =>
      current.filter((attachment) => attachment.id !== attachmentId),
    );

    if (!isPending) {
      setRemovedAttachmentIds((current) =>
        current.includes(attachmentId) ? current : [...current, attachmentId],
      );
    }
  }

  async function downloadAttachment(attachment: TaskAttachment) {
    try {
      const storedAttachment = await getAttachmentBlob(attachment.id);
      if (!storedAttachment) {
        setAttachmentError("This attachment is not available in this browser session.");
        return;
      }

      const url = URL.createObjectURL(storedAttachment.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = attachment.name;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setAttachmentError("");
    } catch {
      setAttachmentError("Could not open that attachment.");
    }
  }

  function handleCreateBoard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentPermissions.manageRoadmap) {
      return;
    }

    const title = boardDraft.title.trim();
    if (!title) {
      return;
    }

    const board: WorkspaceBoard = {
      ...boardDraft,
      id: crypto.randomUUID(),
      title,
      workspace: boardDraft.workspace.trim() || "Clairio Product",
      description:
        boardDraft.description.trim() || `${templateLabels[boardDraft.template]} workspace board.`,
      createdOn: formatDate(new Date()),
      starred: false,
    };

    setBoards((current) => [...current, board]);
    setActiveBoardId(board.id);
    resetBoardForm();
    setShowBoardCreator(false);
  }

  function deleteBoard(boardId: string) {
    if (!currentPermissions.manageRoadmap || activeBoards.length <= 1) {
      return;
    }

    const board = getBoard(activeBoards, boardId);
    const scopedTasks = activeTasks.filter((task) => task.boardId === boardId);
    const taskCopy =
      scopedTasks.length === 1
        ? "1 task on this board will also move to restore."
        : `${scopedTasks.length} tasks on this board will also move to restore.`;
    const confirmed = window.confirm(
      `Delete "${board.title}"?\n\n${taskCopy}\n\nYou can restore it from Access.`,
    );

    if (!confirmed) {
      return;
    }

    const nextBoard =
      activeBoards.find((candidate) => candidate.id !== boardId) ?? activeBoards[0] ?? seedBoards[0];

    setTasks((current) =>
      current.map((task) =>
        task.boardId === boardId && isActiveRecord(task) ? markDeleted(task, currentUser.id) : task,
      ),
    );
    setBoards((current) =>
      current.map((candidate) =>
        candidate.id === boardId ? markDeleted(candidate, currentUser.id) : candidate,
      ),
    );
    setActiveBoardId(nextBoard.id);
    setDraft((current) => ({ ...current, boardId: nextBoard.id }));
    setShowBoardCreator(false);
  }

  function restoreBoard(boardId: string) {
    if (!currentPermissions.manageRoadmap) {
      return;
    }

    setBoards((current) =>
      current.map((board) => (board.id === boardId ? restoreDeleted(board) : board)),
    );
    setTasks((current) =>
      current.map((task) =>
        task.boardId === boardId && isDeletedRecord(task) ? restoreDeleted(task) : task,
      ),
    );
    setActiveBoardId(boardId);
  }

  function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentPermissions.manageUsers) {
      return;
    }

    const name = inviteDraft.name.trim();
    const email = inviteDraft.email.trim().toLowerCase();
    if (!name || !email) {
      setProvisioningNotice("Name and email are required before an invite can be staged.");
      return;
    }

    if (!emailPattern.test(email)) {
      setProvisioningNotice("Use a valid email address before sending the invite.");
      return;
    }

    if (members.some((member) => member.email.toLowerCase() === email)) {
      setProvisioningNotice("That email is already provisioned in this workspace.");
      return;
    }

    const invitedMember: WorkspaceMember = {
      ...inviteDraft,
      id: crypto.randomUUID(),
      name,
      email,
      status: "invited",
      accent: accentForIndex(members.length),
      invitedOn: formatDate(new Date()),
      lastActive: "",
    };

    setMembers((current) => [invitedMember, ...current]);
    setSprints((current) =>
      current.map((sprint) => ({
        ...sprint,
        memberCapacities: {
          ...sprint.memberCapacities,
          [invitedMember.id]: clampCapacity(invitedMember.capacity),
        },
      })),
    );
    resetInviteForm();
    setProvisioningNotice(`Invite staged for ${name}.`);
  }

  function handleCreateRelease(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentPermissions.manageRoadmap) {
      return;
    }

    const name = releaseDraft.name.trim();
    const goal = releaseDraft.goal.trim();
    if (!name || !goal || !releaseDraft.startDate || !releaseDraft.endDate) {
      return;
    }

    if (editingReleaseId) {
      setReleases((current) =>
        current.map((release) =>
          release.id === editingReleaseId
            ? {
                ...release,
                ...releaseDraft,
                name,
                goal,
              }
            : release,
        ),
      );
      setActiveReleaseId(editingReleaseId);
      setEditingReleaseId(null);
      setReleaseDraft(emptyReleaseDraft);
      return;
    }

    const release: Release = {
      ...releaseDraft,
      id: crypto.randomUUID(),
      name,
      goal,
    };

    setReleases((current) => [...current, release]);
    setActiveReleaseId(release.id);
    setActiveSprintId("");
    setPrefersReleaseScope(true);
    setActiveEpicId(ALL_EPICS_ID);
    setEpicDraft((current) => ({ ...current, releaseId: release.id }));
    setSprintDraft((current) => ({ ...current, releaseId: release.id }));
    setReleaseDraft(emptyReleaseDraft);
  }

  function startEditRelease(release: Release) {
    if (!currentPermissions.manageRoadmap) {
      return;
    }

    setReleaseDraft({
      name: release.name,
      goal: release.goal,
      startDate: release.startDate,
      endDate: release.endDate,
    });
    setEditingReleaseId(release.id);
    setActiveReleaseId(release.id);
    changeViewMode("releases");
  }

  function cancelReleaseEdit() {
    setEditingReleaseId(null);
    setReleaseDraft(emptyReleaseDraft);
  }

  function deleteRelease(releaseId: string) {
    if (!currentPermissions.manageRoadmap || activeReleases.length <= 1) {
      return;
    }

    const release = getRelease(activeReleases, releaseId);
    const releaseSprints = activeSprints.filter((sprint) => sprint.releaseId === releaseId);
    const releaseEpics = activeEpics.filter((epic) => epic.releaseId === releaseId);
    const releaseTasks = activeTasks.filter((task) => task.releaseId === releaseId);
    const impactSummary = [
      `${releaseSprints.length} sprint${releaseSprints.length === 1 ? "" : "s"} in this release will also move to restore.`,
      `${releaseEpics.length} epic${releaseEpics.length === 1 ? "" : "s"} in this release will also move to restore.`,
      `${releaseTasks.length} task${releaseTasks.length === 1 ? "" : "s"} in this release will also move to restore.`,
    ].join("\n");
    const confirmed = window.confirm(
      `Delete "${release.name}"?\n\n${impactSummary}\n\nYou can restore it from Access.`,
    );

    if (!confirmed) {
      return;
    }

    const nextRelease =
      activeReleases.find((candidate) => candidate.id !== releaseId) ??
      activeReleases[0] ??
      seedReleases[0];

    setTasks((current) =>
      current.map((task) =>
        task.releaseId === releaseId && isActiveRecord(task)
          ? markDeleted(task, currentUser.id)
          : task,
      ),
    );
    setEpics((current) =>
      current.map((epic) =>
        epic.releaseId === releaseId && isActiveRecord(epic)
          ? markDeleted(epic, currentUser.id)
          : epic,
      ),
    );
    setSprints((current) =>
      current.map((sprint) =>
        sprint.releaseId === releaseId && isActiveRecord(sprint)
          ? markDeleted(sprint, currentUser.id)
          : sprint,
      ),
    );
    setReleases((current) =>
      current.map((candidate) =>
        candidate.id === releaseId ? markDeleted(candidate, currentUser.id) : candidate,
      ),
    );
    setActiveReleaseId(nextRelease.id);
    setDraft((current) => ({
      ...current,
      releaseId: nextRelease.id,
      sprintId: "",
      epicId: activeEpics.find((epic) => epic.releaseId === nextRelease.id)?.id ?? "",
    }));
    if (editingReleaseId === releaseId) {
      cancelReleaseEdit();
    }
    if (editingEpicId && releaseEpics.some((epic) => epic.id === editingEpicId)) {
      cancelEpicEdit();
    }
    if (editingSprintId && releaseSprints.some((sprint) => sprint.id === editingSprintId)) {
      cancelSprintEdit();
    }
    if (editingId && releaseTasks.some((task) => task.id === editingId)) {
      resetForm();
    }
  }

  function restoreRelease(releaseId: string) {
    if (!currentPermissions.manageRoadmap) {
      return;
    }

    setReleases((current) =>
      current.map((release) => (release.id === releaseId ? restoreDeleted(release) : release)),
    );
    setEpics((current) =>
      current.map((epic) =>
        epic.releaseId === releaseId && isDeletedRecord(epic) ? restoreDeleted(epic) : epic,
      ),
    );
    setSprints((current) =>
      current.map((sprint) =>
        sprint.releaseId === releaseId && isDeletedRecord(sprint) ? restoreDeleted(sprint) : sprint,
      ),
    );
    setTasks((current) =>
      current.map((task) =>
        task.releaseId === releaseId && isDeletedRecord(task) ? restoreDeleted(task) : task,
      ),
    );
    setActiveReleaseId(releaseId);
  }

  function handleCreateEpic(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentPermissions.manageRoadmap) {
      return;
    }

    const name = epicDraft.name.trim();
    const goal = epicDraft.goal.trim();
    if (!name || !goal || !epicDraft.ownerId || !epicDraft.releaseId) {
      return;
    }

    if (editingEpicId) {
      setEpics((current) =>
        current.map((epic) =>
          epic.id === editingEpicId
            ? {
                ...epic,
                ...epicDraft,
                name,
                goal,
              }
            : epic,
        ),
      );
      setActiveReleaseId(epicDraft.releaseId);
      setActiveEpicId(editingEpicId);
      setEditingEpicId(null);
      setEpicDraft((current) => ({
        ...emptyEpicDraft,
        ownerId: current.ownerId,
        releaseId: current.releaseId,
      }));
      return;
    }

    const epic: Epic = {
      ...epicDraft,
      id: crypto.randomUUID(),
      name,
      goal,
    };

    setEpics((current) => [...current, epic]);
    setActiveReleaseId(epic.releaseId);
    setActiveEpicId(epic.id);
    setEpicDraft((current) => ({ ...emptyEpicDraft, ownerId: current.ownerId, releaseId: current.releaseId }));
  }

  function startEditEpic(epic: Epic) {
    if (!currentPermissions.manageRoadmap) {
      return;
    }

    setEpicDraft({
      name: epic.name,
      ownerId: epic.ownerId,
      releaseId: epic.releaseId,
      goal: epic.goal,
    });
    setEditingEpicId(epic.id);
    setActiveReleaseId(epic.releaseId);
    setActiveEpicId(epic.id);
    changeViewMode("epics");
  }

  function cancelEpicEdit() {
    setEditingEpicId(null);
    setEpicDraft({ ...emptyEpicDraft, releaseId: activeRelease.id });
  }

  function deleteEpic(epicId: string) {
    if (!currentPermissions.manageRoadmap) {
      return;
    }

    const epic = activeEpics.find((candidate) => candidate.id === epicId);
    if (!epic) {
      return;
    }

    const epicTasks = activeTasks.filter((task) => task.epicId === epicId);
    const taskCopy =
      epicTasks.length === 1
        ? "1 task in this epic will also move to restore."
        : `${epicTasks.length} tasks in this epic will also move to restore.`;
    const confirmed = window.confirm(
      `Delete "${epic.name}"?\n\n${taskCopy}\n\nYou can restore it from Access.`,
    );

    if (!confirmed) {
      return;
    }

    const nextEpicId =
      activeEpics.find((candidate) => candidate.releaseId === epic.releaseId && candidate.id !== epicId)?.id ??
      "";

    setTasks((current) =>
      current.map((task) =>
        task.epicId === epicId && isActiveRecord(task) ? markDeleted(task, currentUser.id) : task,
      ),
    );
    setEpics((current) =>
      current.map((candidate) =>
        candidate.id === epicId ? markDeleted(candidate, currentUser.id) : candidate,
      ),
    );
    if (activeEpicId === epicId) {
      setActiveEpicId(ALL_EPICS_ID);
    }
    setDraft((current) => ({
      ...current,
      epicId: current.epicId === epicId ? nextEpicId : current.epicId,
    }));
    if (editingEpicId === epicId) {
      cancelEpicEdit();
    }
  }

  function restoreEpic(epicId: string) {
    if (!currentPermissions.manageRoadmap) {
      return;
    }

    const epic = epics.find((candidate) => candidate.id === epicId);
    setEpics((current) =>
      current.map((candidate) =>
        candidate.id === epicId ? restoreDeleted(candidate) : candidate,
      ),
    );
    setTasks((current) =>
      current.map((task) =>
        task.epicId === epicId && isDeletedRecord(task) ? restoreDeleted(task) : task,
      ),
    );
    if (epic) {
      setActiveReleaseId(epic.releaseId);
    }
    setActiveEpicId(epicId);
  }

  function handleCreateSprint(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentPermissions.manageRoadmap) {
      return;
    }

    const name = sprintDraft.name.trim();
    const goal = sprintDraft.goal.trim();
    const releaseId = activeReleases.some((release) => release.id === sprintDraft.releaseId)
      ? sprintDraft.releaseId
      : activeRelease.id;
    if (!name || !goal || !releaseId || !sprintDraft.startDate || !sprintDraft.endDate) {
      return;
    }

    if (editingSprintId) {
      setSprints((current) =>
        current.map((sprint) =>
          sprint.id === editingSprintId
            ? {
                ...sprint,
                ...sprintDraft,
                name,
                goal,
                releaseId,
                capacity: Math.max(0, sprintDraft.capacity),
                memberCapacities:
                  Object.keys(sprint.memberCapacities).length > 0
                    ? sprint.memberCapacities
                    : buildSprintMemberCapacities(members),
              }
            : sprint,
        ),
      );
      setActiveReleaseId(releaseId);
      setActiveSprintId(editingSprintId);
      setPrefersReleaseScope(false);
      setEditingSprintId(null);
      setSprintDraft({ ...emptySprintDraft, releaseId });
      return;
    }

    const sprint: Sprint = {
      ...sprintDraft,
      id: crypto.randomUUID(),
      name,
      goal,
      releaseId,
      capacity: Math.max(0, sprintDraft.capacity),
      memberCapacities: buildSprintMemberCapacities(members),
    };

    setSprints((current) => [...current, sprint]);
    setActiveSprintId(sprint.id);
    setPrefersReleaseScope(false);
    setActiveReleaseId(releaseId);
    setDraft((current) => ({ ...current, sprintId: sprint.id }));
    setSprintDraft({ ...emptySprintDraft, releaseId });
  }

  function startEditSprint(sprint: Sprint) {
    if (!currentPermissions.manageRoadmap) {
      return;
    }

    setSprintDraft({
      name: sprint.name,
      goal: sprint.goal,
      releaseId: sprint.releaseId,
      startDate: sprint.startDate,
      endDate: sprint.endDate,
      capacity: sprint.capacity,
      memberCapacities: sprint.memberCapacities,
    });
    setEditingSprintId(sprint.id);
    setActiveReleaseId(sprint.releaseId);
    setActiveSprintId(sprint.id);
    setPrefersReleaseScope(false);
    changeViewMode("sprint");
  }

  function cancelSprintEdit() {
    setEditingSprintId(null);
    setSprintDraft({ ...emptySprintDraft, releaseId: activeRelease.id });
  }

  function deleteSprint(sprintId: string) {
    if (!currentPermissions.manageRoadmap) {
      return;
    }

    const sprint = getSprint(activeSprints, sprintId);
    if (!sprint) {
      return;
    }

    const sprintTasks = activeTasks.filter((task) => task.sprintId === sprintId);
    const taskCopy =
      sprintTasks.length === 1
        ? "1 task in this sprint will also move to restore."
        : `${sprintTasks.length} tasks in this sprint will also move to restore.`;
    const confirmed = window.confirm(
      `Delete "${sprint.name}"?\n\n${taskCopy}\n\nYou can restore it from Access.`,
    );

    if (!confirmed) {
      return;
    }

    setTasks((current) =>
      current.map((task) =>
        task.sprintId === sprintId && isActiveRecord(task)
          ? markDeleted(task, currentUser.id)
          : task,
      ),
    );
    setSprints((current) =>
      current.map((candidate) =>
        candidate.id === sprintId ? markDeleted(candidate, currentUser.id) : candidate,
      ),
    );
    setActiveSprintId("");
    setPrefersReleaseScope(true);
    setDraft((current) => ({ ...current, sprintId: "" }));
    if (editingSprintId === sprintId) {
      cancelSprintEdit();
    }
  }

  function restoreSprint(sprintId: string) {
    if (!currentPermissions.manageRoadmap) {
      return;
    }

    const sprint = sprints.find((candidate) => candidate.id === sprintId);
    setSprints((current) =>
      current.map((sprint) => (sprint.id === sprintId ? restoreDeleted(sprint) : sprint)),
    );
    setTasks((current) =>
      current.map((task) =>
        task.sprintId === sprintId && isDeletedRecord(task) ? restoreDeleted(task) : task,
      ),
    );
    if (sprint) {
      setActiveReleaseId(sprint.releaseId);
    }
    setActiveSprintId(sprintId);
    setPrefersReleaseScope(false);
  }

  function editTask(task: ProductTask) {
    if (!currentPermissions.manageTasks) {
      return;
    }

    const {
      id: _id,
      completedOn: _completedOn,
      deletedAt: _deletedAt,
      deletedBy: _deletedBy,
      createdAt: _createdAt,
      updatedAt: _updatedAt,
      releaseAddedAt: _releaseAddedAt,
      ...taskDraft
    } = task;
    setActiveBoardId(task.boardId);
    setActiveReleaseId(task.releaseId);
    setActiveSprintId(task.sprintId);
    setPrefersReleaseScope(task.sprintId === "");
    setActiveEpicId(task.epicId);
    setDraft(taskDraft);
    setConfirmingTaskDelete(false);
    setEditingId(task.id);
    setShowTaskComposer(true);
    resetAttachmentState();
  }

  function deleteTask(taskId: string) {
    if (!currentPermissions.manageTasks) {
      return;
    }
    setTasks((current) =>
      current.map((task) => (task.id === taskId ? markDeleted(task, currentUser.id) : task)),
    );
    if (editingId === taskId) {
      resetForm();
    }
  }

  function restoreTask(taskId: string) {
    if (!currentPermissions.manageTasks) {
      return;
    }

    const task = tasks.find((candidate) => candidate.id === taskId);
    setTasks((current) =>
      current.map((candidate) =>
        candidate.id === taskId ? restoreDeleted(candidate) : candidate,
      ),
    );

    if (task) {
      setActiveBoardId(task.boardId);
      setActiveReleaseId(task.releaseId);
      setActiveSprintId(task.sprintId);
      setPrefersReleaseScope(task.sprintId === "");
      setActiveEpicId(task.epicId);
    }
  }

  function moveTask(taskId: string, status: TaskStatus) {
    if (!currentPermissions.manageTasks) {
      return;
    }
    setTasks((current) =>
      current.map((task) =>
        task.id === taskId
          ? {
              ...task,
              status,
              completedOn: status === "done" ? task.completedOn || formatDate(new Date()) : "",
            }
          : task,
      ),
    );
  }

  function handleDrop(event: DragEvent<HTMLElement>, status: TaskStatus) {
    event.preventDefault();
    const taskId = event.dataTransfer.getData("text/plain");
    if (taskId) {
      moveTask(taskId, status);
    }
  }

  function changeViewMode(nextView: ViewMode) {
    setViewMode(nextView);
    window.location.hash = nextView === "board" ? "" : nextView;
  }

  function openTaskComposer() {
    setDraft({
      ...emptyDraft,
      boardId: activeBoard.id,
      assigneeId: taskAssignableMembers[0]?.id ?? emptyDraft.assigneeId,
      releaseId: activeRelease.id,
      sprintId: activeSprint?.id ?? "",
      epicId: selectedEpic?.id ?? releaseEpics[0]?.id ?? "",
    });
    setConfirmingTaskDelete(false);
    setEditingId(null);
    setShowTaskComposer(true);
    resetAttachmentState();
  }

  function updateSprintMemberCapacity(memberId: string, capacity: number) {
    if (!currentPermissions.manageUsers || !activeSprint) {
      return;
    }

    setSprints((current) =>
      current.map((sprint) =>
        sprint.id === activeSprint.id
          ? {
              ...sprint,
              memberCapacities: {
                ...sprint.memberCapacities,
                [memberId]: clampCapacity(capacity),
              },
            }
          : sprint,
      ),
    );
  }

  function updateMember(memberId: string, update: Partial<WorkspaceMember>) {
    if (!currentPermissions.manageUsers) {
      return;
    }
    setMembers((current) => {
      const target = current.find((member) => member.id === memberId);
      if (!target) {
        return current;
      }

      const activeOwnerCount = current.filter(
        (member) => member.status === "active" && member.systemRole === "owner",
      ).length;
      const nextRole = update.systemRole
        ? normalizeSystemRole(update.systemRole)
        : target.systemRole;
      const wouldRemoveLastOwner =
        target.status === "active" &&
        target.systemRole === "owner" &&
        nextRole !== "owner" &&
        activeOwnerCount <= 1;

      if (wouldRemoveLastOwner) {
        setProvisioningNotice("Keep at least one active Owner in the workspace.");
        return current;
      }

      const normalizedUpdate: Partial<WorkspaceMember> = { ...update };
      if (update.systemRole) {
        normalizedUpdate.systemRole = nextRole;
      }
      if (update.scrumRole) {
        normalizedUpdate.scrumRole = normalizeScrumRole(update.scrumRole);
      }
      if (typeof update.capacity === "number") {
        normalizedUpdate.capacity = Math.max(0, Math.min(40, update.capacity));
      }

      setProvisioningNotice("");
      return current.map((member) =>
        member.id === memberId ? { ...member, ...normalizedUpdate } : member,
      );
    });
  }

  function setMemberStatus(memberId: string, status: MemberStatus) {
    const member = members.find((candidate) => candidate.id === memberId);
    const activeOwnerCount = members.filter(
      (candidate) => candidate.status === "active" && candidate.systemRole === "owner",
    ).length;

    if (
      member?.systemRole === "owner" &&
      member.status === "active" &&
      status !== "active" &&
      activeOwnerCount <= 1
    ) {
      setProvisioningNotice("Keep at least one active Owner in the workspace.");
      return;
    }

    const lastActive = status === "active" ? formatDate(new Date()) : "";
    updateMember(memberId, { status, lastActive });
  }

  return (
    <main className="app-shell">
      <section className="hero-band">
        <nav className="topbar" aria-label="Product workspace">
          <a className="brand" href="/" aria-label={APP_NAME}>
            <img
              className="brand-logo"
              src={brandLogoSrc}
              alt=""
              aria-hidden="true"
            />
            <span className="brand-copy">
              <strong>Clairio</strong>
              <small>Delivery Intelligence Console</small>
            </span>
          </a>
          <div className="session-tools">
            <div className="session-summary" aria-label="Workspace session context">
              <span className="session-chip">{activeRelease.name}</span>
              <span className="session-chip">
                {roleLabels[currentUser.systemRole]} · {currentUser.name}
              </span>
            </div>
            <button
              className="theme-toggle"
              type="button"
              onClick={() => setThemeMode((current) => (current === "dark" ? "light" : "dark"))}
              aria-label={themeMode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {themeMode === "dark" ? <Sun size={16} /> : <Moon size={16} />}
              {themeMode === "dark" ? "Light" : "Dark"}
            </button>
          </div>
        </nav>

        <div className="hero-grid">
          <div className="hero-copy">
            <span className="hero-eyebrow">Delivery Intelligence For Product Teams</span>
            <h1>{APP_NAME}</h1>
            <p>{APP_SUPPORT_COPY}</p>
            <div className="hero-copy-meta" aria-label="Workspace posture">
              <span>Release intelligence</span>
              <span>Execution command</span>
              <span>Operational clarity</span>
            </div>
          </div>

          <div className="hero-status-cluster" aria-label="Sprint and release signals">
            <article
              className={`signal-card signal-card-${releaseTrackingTone}`}
              aria-label="Release status"
            >
              <div className="signal-card-header">
                <span className="signal-label">Release status</span>
                <span className={`signal-pill signal-pill-${releaseTrackingTone}`}>
                  {releaseTrackingStatus}
                </span>
              </div>
              <strong>{releaseSignalHeadline}</strong>
              <div className="signal-stats" aria-label="Release point totals">
                <span>
                  <strong>{activeReleaseTotalPoints}</strong> pts in release
                </span>
                <span>
                  <strong>{activeReleaseRemainingPoints}</strong> pts remaining
                </span>
              </div>
              <p>{releaseTrackingDetail}</p>
              <small>{activeRelease.name} · target {activeRelease.endDate}</small>
            </article>
            <div className="hero-sprint-pair">
              <div className="command-panel" aria-label="Sprint status">
                <div className="panel-header">
                  <span className="status-light" />
                  <span>{activeSprint?.name ?? "Release scope"}</span>
                </div>
                <strong>{sprintSignalHeadline}</strong>
                <p className="command-meta">{sprintSignalDetail}</p>
                <ProgressBar value={activeSprint ? sprintCompletion : activeReleaseDonePercent} />
              </div>
              <article className="signal-card signal-card-goal" aria-label="Sprint goal">
                <div className="signal-card-header">
                  <span className="signal-label">Sprint goal</span>
                </div>
                <strong>{activeSprint?.name ?? "No sprint selected"}</strong>
                {activeSprint ? (
                  <GoalList goal={sprintGoalCopy} className="signal-goal-list" />
                ) : (
                  <p>Set a sprint goal to keep the team aligned on the sprint outcome.</p>
                )}
                <small>
                  {activeSprint
                    ? `${activeSprint.startDate} to ${activeSprint.endDate}`
                    : "Choose a sprint to track its goal here."}
                </small>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section className="workspace">
        <section className="board-panel" aria-label="Agile product workspace">
          <div
            className="active-board-bar"
            style={{ borderColor: activeBoard.background }}
          >
            <div className="board-swatch" style={{ background: activeBoard.background }} />
            <div className="board-identity">
              <span>{activeBoard.workspace}</span>
              <strong>{activeBoard.title}</strong>
              <div className="board-identity-meta">
                <span>{visibilityLabels[activeBoard.visibility]}</span>
                <span>{templateLabels[activeBoard.template]}</span>
              </div>
              {visibleBoardDescription ? <p>{visibleBoardDescription}</p> : null}
            </div>
            <div className="board-actions">
              <label className="compact-select">
                <ClipboardList size={15} />
                <SelectField
                  value={activeBoard.id}
                  ariaLabel="Select board"
                  onChange={(nextBoardId) => {
                    setActiveBoardId(nextBoardId);
                    updateDraft("boardId", nextBoardId);
                  }}
                  options={activeBoards.map((board) => ({
                    value: board.id,
                    label: board.title,
                  }))}
                />
              </label>
              <button
                className="ghost-button"
                type="button"
                onClick={() => setShowBoardCreator((current) => !current)}
                disabled={!currentPermissions.manageRoadmap}
              >
                <ClipboardList size={16} />
                {showBoardCreator ? "Hide board form" : "Create board"}
              </button>
              <button
                className="primary-button"
                type="button"
                onClick={openTaskComposer}
                disabled={!currentPermissions.manageTasks}
              >
                <CirclePlus size={16} />
                Add work
              </button>
            </div>
          </div>

          <div className="destructive-action-row board-danger-row">
            <button
              className="danger-button danger-button-subtle"
              type="button"
              onClick={() => deleteBoard(activeBoard.id)}
              disabled={!currentPermissions.manageRoadmap || activeBoards.length <= 1}
              title={
                activeBoards.length <= 1
                  ? "Create another board before deleting this one"
                  : `Delete ${activeBoard.title}`
              }
            >
              <Trash2 size={16} />
              Delete board
            </button>
          </div>

          <section className="workspace-command-deck" aria-label="Board command overview">
            <div className="workspace-command-copy">
              <span className="workspace-kicker">Execution surface</span>
              <h2>{workspaceScopeLabel}</h2>
              <p>{workspaceScopeCopy}</p>
            </div>
            <div className="workspace-command-signals">
              <article className="workspace-command-signal">
                <span>Visible work</span>
                <strong>{filteredTasks.length}</strong>
                <small>{filteredTaskPoints} points in the current view</small>
              </article>
              <article className="workspace-command-signal">
                <span>Blocked</span>
                <strong>{filteredBlockedCount}</strong>
                <small>
                  {filteredBlockedCount > 0
                    ? "Stories need intervention"
                    : "No blockers in focus"}
                </small>
              </article>
              <article className="workspace-command-signal">
                <span>Ready queue</span>
                <strong>{filteredReadyCount}</strong>
                <small>
                  {filteredReadyCount > 0
                    ? "Stories primed for pull"
                    : "No ready work queued"}
                </small>
              </article>
              <article className="workspace-command-signal">
                <span>{paceSignalLabel}</span>
                <strong>{paceSignalValue}</strong>
                <small>
                  {activeSprint
                    ? paceSignalDetail
                    : filteredDueSoonCount > 0
                      ? `${filteredDueSoonCount} item${filteredDueSoonCount === 1 ? "" : "s"} due this week`
                      : paceSignalDetail}
                </small>
              </article>
            </div>
          </section>

          {showBoardCreator ? (
            <section className="board-create-panel">
              <article className="summary-card planning-form-card">
                <div className="section-title">
                  <ClipboardList size={18} />
                  <h2>Create board</h2>
                </div>
                <form className="planning-form" onSubmit={handleCreateBoard}>
                  <label>
                    Board title
                    <input
                      value={boardDraft.title}
                      disabled={!currentPermissions.manageRoadmap}
                      onChange={(event) => updateBoardDraft("title", event.target.value)}
                      placeholder="Product Launch Board"
                    />
                  </label>
                  <div className="two-col">
                    <label>
                      Workspace
                      <input
                        value={boardDraft.workspace}
                        disabled={!currentPermissions.manageRoadmap}
                        onChange={(event) => updateBoardDraft("workspace", event.target.value)}
                      />
                    </label>
                    <label>
                      Visibility
                      <SelectField
                        value={boardDraft.visibility}
                        disabled={!currentPermissions.manageRoadmap}
                        onChange={(nextVisibility) =>
                          updateBoardDraft("visibility", nextVisibility as BoardVisibility)
                        }
                        options={visibilityOptions}
                      />
                    </label>
                  </div>
                  <div className="two-col">
                    <label>
                      Template
                      <SelectField
                        value={boardDraft.template}
                        disabled={!currentPermissions.manageRoadmap}
                        onChange={(nextTemplate) =>
                          updateBoardDraft("template", nextTemplate as BoardTemplate)
                        }
                        options={templateOptions}
                      />
                    </label>
                    <label>
                      Background
                      <SelectField
                        value={boardDraft.background}
                        disabled={!currentPermissions.manageRoadmap}
                        onChange={(nextBackground) => updateBoardDraft("background", nextBackground)}
                        options={boardBackgroundOptions}
                      />
                    </label>
                  </div>
                  <label>
                    Description
                    <textarea
                      value={boardDraft.description}
                      disabled={!currentPermissions.manageRoadmap}
                      onChange={(event) => updateBoardDraft("description", event.target.value)}
                      placeholder="What kind of work should live on this board?"
                    />
                  </label>
                  <button
                    className="primary-button"
                    type="submit"
                    disabled={!currentPermissions.manageRoadmap}
                  >
                    <CirclePlus size={16} />
                    Create board
                  </button>
                </form>
              </article>
              <article className="board-preview-card" style={{ borderColor: boardDraft.background }}>
                <div className="board-preview-surface" style={{ background: boardDraft.background }}>
                  <span>{boardDraft.workspace}</span>
                  <strong>{boardDraft.title || "Untitled board"}</strong>
                  <p>{templateLabels[boardDraft.template]} · {visibilityLabels[boardDraft.visibility]}</p>
                </div>
              </article>
            </section>
          ) : null}

          <section className="planning-switcher" aria-label="Planning navigation">
            <div className="planning-switcher-header">
              <div>
                <span className="planning-kicker">Planning Rail</span>
                <strong>{activeRelease.name}</strong>
              </div>
              <p>
                Set release, sprint, and epic context once, then move between execution and reporting
                without losing scope.
              </p>
            </div>
            <div className="planning-selectors">
              <label className="planning-selector">
                Release
                <span className="compact-select">
                  <Flag size={15} aria-hidden="true" />
                  <SelectField
                    value={activeReleaseId}
                    ariaLabel="Select release"
                    onChange={selectActiveRelease}
                    options={activeReleases.map((release) => ({
                      value: release.id,
                      label: release.name,
                    }))}
                  />
                </span>
                <small>{Math.round(activeReleaseDonePercent)}% done · {activeRelease.endDate}</small>
              </label>
              <label className="planning-selector">
                Sprint
                <span className="compact-select">
                  <Target size={15} aria-hidden="true" />
                  <SelectField
                    value={activeSprintId}
                    ariaLabel="Select sprint"
                    onChange={(nextSprintId) => {
                      setActiveSprintId(nextSprintId);
                      setPrefersReleaseScope(nextSprintId === "");
                      updateDraft("sprintId", nextSprintId);
                    }}
                    options={[
                      { value: "", label: "Release scope" },
                      ...releaseSprints.map((sprint) => ({
                        value: sprint.id,
                        label: sprint.name,
                      })),
                    ]}
                  />
                </span>
                <small>
                  {activeSprint
                    ? `${sprintRemaining} pts left · ${sprintCommitted}/${activeSprint.capacity} capacity`
                    : "Showing all release work"}
                </small>
              </label>
              <label className="planning-selector">
                Epic
                <span className="compact-select">
                  <Layers3 size={15} aria-hidden="true" />
                  <SelectField
                    value={activeEpicId}
                    ariaLabel="Select epic"
                    onChange={selectActiveEpic}
                    options={[
                      { value: ALL_EPICS_ID, label: "All epics" },
                      ...releaseEpics.map((epic) => ({
                        value: epic.id,
                        label: epic.name,
                      })),
                    ]}
                  />
                </span>
                <small>
                  {activeEpicRemainingPoints} pts left · {activeEpicOwner?.name ?? "All owners"}
                </small>
              </label>
            </div>
            <div className="planning-view-toggle" aria-label="Quick planning views">
              {[
                ["board", "Kanban", ClipboardList],
                ["sprint", "Sprint", Target],
                ["epics", "Epics", Layers3],
                ["releases", "Releases", Flag],
                ["reports", "Reports", BarChart3],
              ].map(([view, label, Icon]) => (
                <button
                  key={view as string}
                  className={viewMode === view ? "active" : ""}
                  type="button"
                  onClick={() => changeViewMode(view as ViewMode)}
                >
                  <Icon size={15} />
                  {label as string}
                </button>
              ))}
            </div>
          </section>

          {isTaskComposerOpen
            ? createPortal(
                <div
                  className="composer-modal-overlay"
                  role="presentation"
                  onClick={resetForm}
                >
                  <section
                    className="composer-panel composer-modal"
                    role="dialog"
                    aria-modal="true"
                    aria-label={editingId ? "Edit task" : "Add task"}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <form className="task-form" onSubmit={handleSubmit}>
                      <div className="composer-modal-header">
                        <div className="section-title">
                          {editingId ? <Pencil size={18} /> : <CirclePlus size={18} />}
                          <h2>{editingId ? "Edit story" : "Add product work"}</h2>
                        </div>
                        <button
                          className="ghost-button composer-close-button"
                          type="button"
                          onClick={resetForm}
                          aria-label="Close task composer"
                        >
                          <X size={16} />
                        </button>
                      </div>

                      {!currentPermissions.manageTasks ? (
                        <p className="permission-note">
                          {roleLabels[currentUser.systemRole]} can view delivery work, but cannot
                          add, edit, move, or delete tasks in this workspace.
                        </p>
                      ) : null}

                      {selectedTask ? (
                        <p className="editing-note">
                          Editing <strong>{selectedTask.title}</strong>
                        </p>
                      ) : null}

                      <label>
                        Title
                        <input
                          value={draft.title}
                          disabled={!currentPermissions.manageTasks}
                          onChange={(event) => updateDraft("title", event.target.value)}
                          placeholder="As a user, I want..."
                        />
                      </label>

                      <label>
                        Board
                        <SelectField
                          value={draft.boardId}
                          disabled={!currentPermissions.manageTasks}
                          onChange={(nextBoardId) => {
                            updateDraft("boardId", nextBoardId);
                            setActiveBoardId(nextBoardId);
                          }}
                          options={activeBoards.map((board) => ({
                            value: board.id,
                            label: board.title,
                          }))}
                        />
                      </label>

                      <div className="two-col">
                        <label>
                          Assignee
                          <SelectField
                            value={draft.assigneeId}
                            disabled={!currentPermissions.manageTasks}
                            onChange={(nextAssigneeId) => updateDraft("assigneeId", nextAssigneeId)}
                            options={taskAssignableMembers.map((member) => ({
                              value: member.id,
                              label: member.name,
                            }))}
                          />
                        </label>
                        <label>
                          Type
                          <SelectField
                            value={draft.type}
                            disabled={!currentPermissions.manageTasks}
                            onChange={(nextType) => updateDraft("type", nextType as TaskType)}
                            options={taskTypeOptions}
                          />
                        </label>
                      </div>

                      <div className="two-col">
                        <label>
                          Points
                          <SelectField
                            value={String(draft.points)}
                            disabled={!currentPermissions.manageTasks}
                            onChange={(nextPoints) => updateDraft("points", Number(nextPoints) as StoryPoints)}
                            options={fibonacciOptions}
                          />
                        </label>
                        <label>
                          Priority
                          <SelectField
                            value={draft.priority}
                            disabled={!currentPermissions.manageTasks}
                            onChange={(nextPriority) => updateDraft("priority", nextPriority as Priority)}
                            options={priorityOptions}
                          />
                        </label>
                      </div>

                      <label>
                        Status
                        <SelectField
                          value={draft.status}
                          disabled={!currentPermissions.manageTasks}
                          onChange={(nextStatus) => updateDraft("status", nextStatus as TaskStatus)}
                          options={laneOptions}
                        />
                      </label>

                      <label>
                        Epic
                        <SelectField
                          value={draftReleaseEpics.some((epic) => epic.id === draft.epicId) ? draft.epicId : ""}
                          disabled={!currentPermissions.manageTasks || draftReleaseEpics.length === 0}
                          onChange={(nextEpicId) => {
                            const epic = draftReleaseEpics.find((candidate) => candidate.id === nextEpicId);
                            if (!epic) {
                              return;
                            }
                            updateDraft("epicId", epic.id);
                            updateDraft("releaseId", epic.releaseId);
                          }}
                          options={
                            draftReleaseEpics.length === 0
                              ? [{ value: "", label: "Create an epic for this release first", disabled: true }]
                              : draftReleaseEpics.map((epic) => ({
                                  value: epic.id,
                                  label: epic.name,
                                }))
                          }
                        />
                      </label>

                      <div className="two-col">
                        <label>
                          Release
                          <SelectField
                            value={draft.releaseId}
                            disabled={!currentPermissions.manageTasks}
                            onChange={selectDraftRelease}
                            options={activeReleases.map((release) => ({
                              value: release.id,
                              label: release.name,
                            }))}
                          />
                        </label>
                        <label>
                          Sprint
                          <SelectField
                            value={draft.sprintId}
                            disabled={!currentPermissions.manageTasks}
                            onChange={(nextSprintId) => updateDraft("sprintId", nextSprintId)}
                            options={[
                              { value: "", label: "Unassigned sprint" },
                              ...draftReleaseSprints.map((sprint) => ({
                                value: sprint.id,
                                label: sprint.name,
                              })),
                            ]}
                          />
                        </label>
                      </div>

                      <label>
                        Due date
                        <input
                          type="date"
                          value={draft.dueDate}
                          disabled={!currentPermissions.manageTasks}
                          onChange={(event) => updateDraft("dueDate", event.target.value)}
                        />
                      </label>

                      <label>
                        Acceptance criteria
                        <textarea
                          value={draft.acceptance}
                          disabled={!currentPermissions.manageTasks}
                          onChange={(event) => updateDraft("acceptance", event.target.value)}
                          placeholder="Given..., when..., then..."
                        />
                      </label>

                      <label>
                        Notes
                        <textarea
                          value={draft.notes}
                          disabled={!currentPermissions.manageTasks}
                          onChange={(event) => updateDraft("notes", event.target.value)}
                          placeholder="Decision, blocker, context, or follow-up"
                        />
                      </label>

                      <div className="attachment-field">
                        <label
                          className="attachment-dropzone"
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={handleAttachmentDrop}
                        >
                          <input
                            key={attachmentInputKey}
                            type="file"
                            multiple
                            disabled={!currentPermissions.manageTasks}
                            onChange={handleAttachmentInput}
                          />
                          <UploadCloud size={18} aria-hidden="true" />
                          <span>
                            <strong>Attach documents</strong>
                            <small>Drop files here or browse from your computer</small>
                          </span>
                        </label>
                        {attachmentError ? <p className="attachment-error">{attachmentError}</p> : null}
                        {draft.attachments.length > 0 ? (
                          <div className="attachment-list" aria-label="Task attachments">
                            {draft.attachments.map((attachment) => (
                              <div className="attachment-row" key={attachment.id}>
                                <FileText size={16} aria-hidden="true" />
                                <span>
                                  <strong>{attachment.name}</strong>
                                  <small>
                                    {attachmentTypeLabel(attachment)} · {formatFileSize(attachment.size)}
                                  </small>
                                </span>
                                <div>
                                  {!pendingAttachments.some((pending) => pending.id === attachment.id) ? (
                                    <button
                                      type="button"
                                      onClick={() => downloadAttachment(attachment)}
                                    >
                                      <Download size={14} />
                                      Download
                                    </button>
                                  ) : null}
                                  <button
                                    type="button"
                                    disabled={!currentPermissions.manageTasks}
                                    onClick={() => removeDraftAttachment(attachment.id)}
                                  >
                                    <X size={14} />
                                    Remove
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>

                      <div className="form-actions">
                        <button
                          className="primary-button"
                          type="submit"
                          disabled={!currentPermissions.manageTasks}
                        >
                          {editingId ? <Save size={16} /> : <Check size={16} />}
                          {editingId ? "Save changes" : "Add work"}
                        </button>
                        <button className="ghost-button" type="button" onClick={resetForm}>
                          <X size={16} />
                          Cancel
                        </button>
                      </div>
                      {editingId ? (
                        <div className="destructive-action-row composer-danger-row">
                          <p className="delete-confirm-note">
                            {confirmingTaskDelete
                              ? "Click delete again to move this task into restore."
                              : "Delete is kept separate from save so it cannot be hit by accident."}
                          </p>
                          <button
                            className={
                              confirmingTaskDelete
                                ? "danger-button"
                                : "danger-button danger-button-subtle"
                            }
                            type="button"
                            disabled={!currentPermissions.manageTasks}
                            onClick={() => {
                              if (!editingId) {
                                return;
                              }

                              if (!confirmingTaskDelete) {
                                setConfirmingTaskDelete(true);
                                return;
                              }

                              deleteTask(editingId);
                            }}
                          >
                            <Trash2 size={15} />
                            {confirmingTaskDelete ? "Confirm delete" : "Delete task"}
                          </button>
                        </div>
                      ) : null}
                    </form>
                  </section>
                </div>,
                document.body,
              )
            : null}

	          <div className="metric-row">
	            {metrics.map((metric) => (
	              <article
	                className={`metric-card metric-${metric.tone} ${
	                  metric.variant === "text" ? "metric-text-card" : ""
	                }`}
	                key={metric.label}
	              >
	                <span>{metric.label}</span>
	                <strong>
	                  {metric.value}
	                  {metric.suffix ? <small>{metric.suffix}</small> : null}
	                </strong>
	                {metric.detail ? <p className="metric-note">{metric.detail}</p> : null}
	              </article>
	            ))}
	          </div>

          <div className="view-tabs" aria-label="Workspace views">
            {[
              ["reports", "Reports", BarChart3],
              ["team", "Team Load", UsersRound],
              ["access", "Access", ShieldCheck],
            ].map(([view, label, Icon]) => (
              <button
                key={view as string}
                className={viewMode === view ? "active" : ""}
                type="button"
                onClick={() => changeViewMode(view as ViewMode)}
              >
                <Icon size={15} />
                {label as string}
              </button>
            ))}
          </div>

          <div className="filters" aria-label="Task filters">
            <div className="search-field">
              <Search size={16} aria-hidden="true" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search stories, people, epics, or notes"
              />
            </div>
            <label className="compact-select">
              <BarChart3 size={15} aria-hidden="true" />
              <SelectField
                value={priorityFilter}
                ariaLabel="Filter by priority"
                onChange={(nextPriority) => setPriorityFilter(nextPriority as Priority | "all")}
                options={[{ value: "all", label: "All priorities" }, ...priorityOptions]}
              />
            </label>
            <label className="compact-select">
              <UserRound size={15} aria-hidden="true" />
              <SelectField
                value={assigneeFilter}
                ariaLabel="Filter by assignee"
                onChange={setAssigneeFilter}
                options={[
                  { value: "all", label: "All assignees" },
                  ...members.map((member) => ({
                    value: member.id,
                    label: member.name,
                  })),
                ]}
              />
            </label>
          </div>

          {viewMode === "board" ? (
            <>
              <div className="board-grid">
                {lanes.map((lane) => {
                  const laneTasks = filteredTasks.filter((task) => task.status === lane.id);
                  const lanePoints = sumPoints(laneTasks);
                  const wipWarning = lane.wip ? laneTasks.length > lane.wip : false;

                  return (
                    <section
                      className={`lane ${lane.id} ${wipWarning ? "wip-warning" : ""}`}
                      key={lane.id}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => handleDrop(event, lane.id)}
                    >
                      <header className="lane-header">
                        <div>
                          <h2>{lane.label}</h2>
                          <p>
                            {lane.helper}
                            {lane.wip ? ` · WIP ${lane.wip}` : ""}
                          </p>
                        </div>
                        <span>{laneTasks.length} / {lanePoints}</span>
                      </header>

                      <div className="task-list">
                        {laneTasks.length > 0 ? (
                          laneTasks.map((task) => {
                            const member = getMember(members, task.assigneeId);
                            const epic = getEpic(epics, task.epicId);
                            const release = getRelease(activeReleases, task.releaseId);

                            return (
                              <article
                                className={`task-card ${task.status}`}
                                key={task.id}
                                draggable={currentPermissions.manageTasks}
                                onDragStart={(event) => {
                                  if (currentPermissions.manageTasks) {
                                    event.dataTransfer.setData("text/plain", task.id);
                                  }
                                }}
                              >
                                <div className="task-card-top">
                                  <div className="task-pills">
                                    <span className={`priority-pill ${task.priority}`}>
                                      {priorityLabels[task.priority]}
                                    </span>
                                    <span className="point-pill">{task.points} pts</span>
                                    {task.attachments.length > 0 ? (
                                      <span className="attachment-pill">
                                        <Paperclip size={12} />
                                        {task.attachments.length}
                                      </span>
                                    ) : null}
                                  </div>
                                <div className="task-actions">
                                    <button
                                      type="button"
                                      draggable={false}
                                      aria-label={`Edit ${task.title}`}
                                      disabled={!currentPermissions.manageTasks}
                                      onMouseDown={(event) => event.stopPropagation()}
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        editTask(task);
                                      }}
                                      onDragStart={(event) => event.preventDefault()}
                                    >
                                      <Pencil size={15} />
                                    </button>
                                  </div>
                                </div>

                                <h3>{task.title}</h3>
                                <p>{task.acceptance || task.notes}</p>

                                <dl className="task-meta">
                                  <div>
                                    <dt><UserRound size={14} />Assignee</dt>
                                    <dd>{member.name}</dd>
                                  </div>
                                  <div>
                                    <dt><CalendarDays size={14} />Due</dt>
                                    <dd>{task.dueDate || "No date"}</dd>
                                  </div>
                                </dl>

                                {task.attachments.length > 0 ? (
                                  <div className="task-attachment-list">
                                    {task.attachments.map((attachment) => (
                                      <button
                                        key={attachment.id}
                                        type="button"
                                        onClick={() => downloadAttachment(attachment)}
                                      >
                                        <Paperclip size={13} />
                                        {attachment.name}
                                      </button>
                                    ))}
                                  </div>
                                ) : null}

                                <div className="task-footer">
                                  <span>{typeLabels[task.type]} · {epic.name}</span>
                                  <span>{release.name}</span>
                                  <SelectField
                                    value={task.status}
                                    disabled={!currentPermissions.manageTasks}
                                    size="small"
                                    onChange={(nextStatus) => moveTask(task.id, nextStatus as TaskStatus)}
                                    aria-label={`Move ${task.title}`}
                                    options={laneOptions}
                                  />
                                </div>
                              </article>
                            );
                          })
                        ) : (
                          <div className="empty-lane">
                            <AlertCircle size={18} />
                            <span>No work in this selected scope</span>
                          </div>
                        )}
                      </div>
                    </section>
                  );
                })}
              </div>
            </>
          ) : null}

          {viewMode === "sprint" ? (
            <section className="insight-grid">
              <article className="summary-card planning-form-card">
                <div className="section-title">
                  <Target size={18} />
                  <h2>{editingSprintId ? "Edit sprint" : "Create sprint"}</h2>
                </div>
                <form className="planning-form" onSubmit={handleCreateSprint}>
                  <label>
                    Sprint name
                    <input
                      value={sprintDraft.name}
                      disabled={!currentPermissions.manageRoadmap}
                      onChange={(event) => updateSprintDraft("name", event.target.value)}
                      placeholder="Sprint 1"
                    />
                  </label>
                  <label>
                    Sprint goal
                    <textarea
                      value={sprintDraft.goal}
                      disabled={!currentPermissions.manageRoadmap}
                      onChange={(event) => updateSprintDraft("goal", event.target.value)}
                      placeholder={"1. Confirm the sprint outcome\n2. Finish the highest-value work\n3. Close launch blockers"}
                    />
                    <small className="goal-hint">Enter one goal per line. Numbering renders automatically.</small>
                  </label>
                  <label>
                    Release
                    <SelectField
                      value={sprintDraft.releaseId}
                      disabled={!currentPermissions.manageRoadmap}
                      onChange={(nextReleaseId) => updateSprintDraft("releaseId", nextReleaseId)}
                      options={activeReleases.map((release) => ({
                        value: release.id,
                        label: release.name,
                      }))}
                    />
                  </label>
                  <div className="three-col">
                    <label>
                      Start
                      <input
                        type="date"
                        value={sprintDraft.startDate}
                        disabled={!currentPermissions.manageRoadmap}
                        onChange={(event) => updateSprintDraft("startDate", event.target.value)}
                      />
                    </label>
                    <label>
                      End
                      <input
                        type="date"
                        value={sprintDraft.endDate}
                        disabled={!currentPermissions.manageRoadmap}
                        onChange={(event) => updateSprintDraft("endDate", event.target.value)}
                      />
                    </label>
                    <label>
                      Capacity
                      <input
                        type="number"
                        min="0"
                        max="200"
                        value={sprintDraft.capacity}
                        disabled={!currentPermissions.manageRoadmap}
                        onChange={(event) =>
                          updateSprintDraft("capacity", Number(event.target.value))
                        }
                      />
                    </label>
                  </div>
                  <button
                    className="primary-button"
                    type="submit"
                    disabled={!currentPermissions.manageRoadmap}
                  >
                    {editingSprintId ? <Save size={16} /> : <CirclePlus size={16} />}
                    {editingSprintId ? "Save sprint" : "Create sprint"}
                  </button>
                  {editingSprintId ? (
                    <button className="ghost-button" type="button" onClick={cancelSprintEdit}>
                      <X size={16} />
                      Cancel edit
                    </button>
                  ) : null}
                </form>
              </article>
              {activeSprint ? (
                <>
                  <article className="summary-card wide">
                    <h2>{activeSprint.name}</h2>
                    <GoalList goal={activeSprint.goal} />
                    <div className="summary-stats">
                      <span><strong>{sprintCommitted}</strong> committed</span>
                      <span><strong>{sprintCompleted}</strong> completed</span>
                      <span><strong>{sprintRemaining}</strong> remaining</span>
                      <span><strong>{activeSprint.capacity}</strong> capacity</span>
                    </div>
                    <ProgressBar value={sprintCompletion} />
                    <button
                      className="ghost-button inline-action"
                      type="button"
                      disabled={!currentPermissions.manageRoadmap}
                      onClick={() => startEditSprint(activeSprint)}
                    >
                      <Pencil size={16} />
                      Edit sprint
                    </button>
                    <div className="destructive-action-row">
                      <button
                        className="danger-button danger-button-subtle"
                        type="button"
                        disabled={!currentPermissions.manageRoadmap}
                        onClick={() => deleteSprint(activeSprint.id)}
                      >
                        <Trash2 size={16} />
                        Delete sprint
                      </button>
                    </div>
                  </article>
                  <BurndownChart
                    title={`${activeSprint.name} burndown`}
                    subtitle={`${activeSprint.startDate} to ${activeSprint.endDate}`}
                    points={calculateBurndown(sprintTasks, activeSprint.startDate, activeSprint.endDate)}
                  />
                </>
              ) : (
                <article className="summary-card empty-state-card">
                  <Target size={24} />
                  <h2>No sprint planned yet</h2>
                  <p>Create Sprint 1 to start capacity tracking and burndown reporting.</p>
                </article>
              )}
            </section>
          ) : null}

          {viewMode === "epics" ? (
            <section className="insight-grid">
              <article className="summary-card planning-form-card">
                <div className="section-title">
                  <Layers3 size={18} />
                  <h2>{editingEpicId ? "Edit epic" : "Create epic"}</h2>
                </div>
                <form className="planning-form" onSubmit={handleCreateEpic}>
                  <label>
                    Epic name
                    <input
                      value={epicDraft.name}
                      disabled={!currentPermissions.manageRoadmap}
                      onChange={(event) => updateEpicDraft("name", event.target.value)}
                      placeholder="Customer Evidence Loop"
                    />
                  </label>
                  <label>
                    Outcome
                    <textarea
                      value={epicDraft.goal}
                      disabled={!currentPermissions.manageRoadmap}
                      onChange={(event) => updateEpicDraft("goal", event.target.value)}
                      placeholder={"1. Clarify the customer outcome\n2. Reduce team friction\n3. Make progress visible"}
                    />
                    <small className="goal-hint">Enter one goal per line. Numbering renders automatically.</small>
                  </label>
                  <div className="two-col">
                    <label>
                      Owner
                      <SelectField
                        value={epicDraft.ownerId}
                        disabled={!currentPermissions.manageRoadmap}
                        onChange={(nextOwnerId) => updateEpicDraft("ownerId", nextOwnerId)}
                        options={taskAssignableMembers.map((member) => ({
                          value: member.id,
                          label: member.name,
                        }))}
                      />
                    </label>
                    <label>
                      Release
                      <SelectField
                        value={epicDraft.releaseId}
                        disabled={!currentPermissions.manageRoadmap}
                        onChange={(nextReleaseId) => updateEpicDraft("releaseId", nextReleaseId)}
                        options={activeReleases.map((release) => ({
                          value: release.id,
                          label: release.name,
                        }))}
                      />
                    </label>
                  </div>
                  <button
                    className="primary-button"
                    type="submit"
                    disabled={!currentPermissions.manageRoadmap}
                  >
                    {editingEpicId ? <Save size={16} /> : <CirclePlus size={16} />}
                    {editingEpicId ? "Save epic" : "Create epic"}
                  </button>
                  {editingEpicId ? (
                    <button className="ghost-button" type="button" onClick={cancelEpicEdit}>
                      <X size={16} />
                      Cancel edit
                    </button>
                  ) : null}
                </form>
              </article>
              {releaseEpics.map((epic) => {
                const epicTasks = boardTasks.filter((task) => task.epicId === epic.id);
                const total = sumPoints(epicTasks);
                const done = completedPoints(epicTasks);
                const percent = total > 0 ? (done / total) * 100 : 0;

                return (
                  <article className="summary-card" key={epic.id}>
                    <h2>{epic.name}</h2>
                    <GoalList goal={epic.goal} />
                    <div className="summary-stats">
                      <span><strong>{done}</strong> done</span>
                      <span><strong>{total - done}</strong> left</span>
                      <span><strong>{epicTasks.length}</strong> tasks</span>
                    </div>
                    <ProgressBar value={percent} />
	                    <button
	                      className="ghost-button inline-action"
	                      type="button"
	                      disabled={!currentPermissions.manageRoadmap}
	                      onClick={() => startEditEpic(epic)}
	                    >
	                      <Pencil size={16} />
	                      Edit epic
	                    </button>
                      <div className="destructive-action-row">
	                    <button
	                      className="danger-button danger-button-subtle"
	                      type="button"
	                      disabled={!currentPermissions.manageRoadmap}
	                      onClick={() => deleteEpic(epic.id)}
	                    >
	                      <Trash2 size={16} />
	                      Delete epic
	                    </button>
                      </div>
	                  </article>
	                );
	              })}
              <BurndownChart
                title={`${activeEpicLabel} burndown`}
                subtitle={selectedEpic?.goal ?? activeRelease.goal}
                points={calculateBurndown(
                  activeEpicTasks,
                  activeRelease.startDate,
                  activeRelease.endDate,
                )}
              />
            </section>
          ) : null}

          {viewMode === "releases" ? (
            <section className="insight-grid">
              <article className="summary-card planning-form-card">
                <div className="section-title">
                  <Flag size={18} />
                  <h2>{editingReleaseId ? "Edit release" : "Create release"}</h2>
                </div>
                <form className="planning-form" onSubmit={handleCreateRelease}>
                  <label>
                    Release name
                    <input
                      value={releaseDraft.name}
                      disabled={!currentPermissions.manageRoadmap}
                      onChange={(event) => updateReleaseDraft("name", event.target.value)}
                      placeholder="June Launch Readiness"
                    />
                  </label>
                  <label>
                    Release goal
                    <textarea
                      value={releaseDraft.goal}
                      disabled={!currentPermissions.manageRoadmap}
                      onChange={(event) => updateReleaseDraft("goal", event.target.value)}
                      placeholder={"1. Finalize the release scope\n2. Prove launch readiness\n3. Confirm customer handoff"}
                    />
                    <small className="goal-hint">Enter one goal per line. Numbering renders automatically.</small>
                  </label>
                  <div className="two-col">
                    <label>
                      Start
                      <input
                        type="date"
                        value={releaseDraft.startDate}
                        disabled={!currentPermissions.manageRoadmap}
                        onChange={(event) => updateReleaseDraft("startDate", event.target.value)}
                      />
                    </label>
                    <label>
                      Ship target
                      <input
                        type="date"
                        value={releaseDraft.endDate}
                        disabled={!currentPermissions.manageRoadmap}
                        onChange={(event) => updateReleaseDraft("endDate", event.target.value)}
                      />
                    </label>
                  </div>
                  <button
                    className="primary-button"
                    type="submit"
                    disabled={!currentPermissions.manageRoadmap}
                  >
                    {editingReleaseId ? <Save size={16} /> : <CirclePlus size={16} />}
                    {editingReleaseId ? "Save release" : "Create release"}
                  </button>
                  {editingReleaseId ? (
                    <button className="ghost-button" type="button" onClick={cancelReleaseEdit}>
                      <X size={16} />
                      Cancel edit
                    </button>
                  ) : null}
                </form>
              </article>
              {activeReleases.map((release) => {
                const releaseTasks = boardTasks.filter((task) => task.releaseId === release.id);
                const total = sumPoints(releaseTasks);
                const done = completedPoints(releaseTasks);
                const percent = total > 0 ? (done / total) * 100 : 0;

                return (
                  <article className="summary-card" key={release.id}>
                    <h2>{release.name}</h2>
                    <GoalList goal={release.goal} />
                    <div className="summary-stats">
                      <span><strong>{done}</strong> done</span>
                      <span><strong>{total}</strong> committed</span>
                      <span><strong>{release.endDate}</strong> ship target</span>
                    </div>
                    <ProgressBar value={percent} />
                    <button
                      className="ghost-button inline-action"
                      type="button"
                      disabled={!currentPermissions.manageRoadmap}
                      onClick={() => startEditRelease(release)}
                    >
                      <Pencil size={16} />
                      Edit release
                    </button>
                    <div className="destructive-action-row">
                      <button
                        className="danger-button danger-button-subtle"
                        type="button"
                        disabled={!currentPermissions.manageRoadmap || activeReleases.length <= 1}
                        onClick={() => deleteRelease(release.id)}
                      >
                        <Trash2 size={16} />
                        Delete release
                      </button>
                    </div>
                  </article>
                );
              })}
              <BurndownChart
                title={`${activeRelease.name} burndown`}
                subtitle={`${activeRelease.startDate} to ${activeRelease.endDate}`}
                points={calculateBurndown(
                  activeReleaseTasks,
                  activeRelease.startDate,
                  activeRelease.endDate,
                )}
              />
            </section>
          ) : null}

          {viewMode === "reports" ? (
            <section className="reports-grid">
              <article className="summary-card selector-row report-summary-card">
                <div className="section-title">
                  <BarChart3 size={18} />
                  <h2>{activeRelease.name} reporting</h2>
                </div>
                <p>
                  Release reporting rolls up backlog carried into each sprint, scope added inside
                  the sprint, completed work, and what remained after sprint close.
                </p>
                <div className="summary-stats">
                  <span>
                    <strong>{activeReleaseTotalPoints}</strong> pts in release
                  </span>
                  <span>
                    <strong>{activeReleaseRemainingPoints}</strong> pts remaining
                  </span>
                  <span>
                    <strong>{releaseScopeAddedPoints}</strong> pts added across sprints
                  </span>
                  <span>
                    <strong>{releaseAverageVelocity}</strong> avg sprint velocity
                  </span>
                  <span>
                    <strong>
                      {releaseProjectedSprintsRemaining === null
                        ? "TBD"
                        : releaseProjectedSprintsRemaining}
                    </strong>{" "}
                    projected sprints left
                  </span>
                  {latestReleaseReportRow ? (
                    <span>
                      <strong>{latestReleaseReportRow.unestimatedRemainingCount}</strong>{" "}
                      unestimated items left
                    </span>
                  ) : null}
                </div>
                <p className="report-projection-copy">{releaseProjectionCopy}</p>
              </article>
              {releaseReportRows.length > 0 ? (
                <>
                  <BurndownChart
                    className="report-primary-chart"
                    title={`${activeRelease.name} burndown`}
                    subtitle={`${activeRelease.startDate} to ${activeRelease.endDate}`}
                    points={releaseBurndownPoints}
                  />
                  <ReleaseScopeChart
                    className="report-secondary-chart"
                    title="Release scope trend"
                    subtitle="Total scoped work versus work still remaining after each sprint."
                    rows={releaseReportRows}
                  />
                  <ReleaseSprintBarsChart
                    className="report-secondary-chart"
                    title="Sprint backlog accounting"
                    subtitle="Backlog carried in, scope added during sprint, and work completed."
                    rows={releaseReportRows}
                  />
                  <article className="summary-card wide report-accounting-card">
                    <div className="section-title">
                      <ClipboardList size={18} />
                      <h2>Release sprint accounting</h2>
                    </div>
                    <div className="report-table-wrap">
                      <table className="report-table">
                        <thead>
                          <tr>
                            <th>Sprint</th>
                            <th>Dates</th>
                            <th>Starting backlog</th>
                            <th>Added in sprint</th>
                            <th>Completed in sprint</th>
                            <th>Remaining after sprint</th>
                            <th>Unestimated left</th>
                          </tr>
                        </thead>
                        <tbody>
                          {releaseReportRows.map((row) => (
                            <tr key={row.sprintId}>
                              <td>{row.sprintName}</td>
                              <td>
                                {row.startDate} to {row.endDate}
                              </td>
                              <td>{row.startingBacklog} pts</td>
                              <td>{row.addedInSprint} pts</td>
                              <td>{row.completedInSprint} pts</td>
                              <td>{row.remainingAfterSprint} pts</td>
                              <td>{row.unestimatedRemainingCount}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </article>
                </>
              ) : (
                <article className="summary-card empty-state-card selector-row">
                  <BarChart3 size={24} />
                  <h2>No sprint reporting yet</h2>
                  <p>Create at least one sprint in this release to unlock sprint-by-sprint release reporting.</p>
                </article>
              )}
            </section>
          ) : null}

          {viewMode === "team" ? (
            <section className="team-grid">
              <article className="summary-card selector-row team-scope-card">
                <div className="section-title">
                  <UsersRound size={18} />
                  <h2>Team load for {teamScopeName}</h2>
                </div>
                <div className="summary-stats">
                  <span>
                    <strong>{teamCapacityTotal}</strong> team capacity
                  </span>
                  <span>
                    <strong>{teamAssignedTotal}</strong> assigned pts
                  </span>
                  <span>
                    <strong>{teamRemainingTotal}</strong> remaining pts
                  </span>
                  {activeSprint && teamOverCapacity > 0 ? (
                    <span className="summary-stat-warning">
                      <strong>{teamOverCapacity}</strong> pts over capacity
                    </span>
                  ) : null}
                </div>
                <p>{teamScopeDetail}</p>
              </article>
              {activeMembers.map((member) => {
                const memberTasks = teamScopeTasks.filter((task) => task.assigneeId === member.id);
                const assigned = sumPoints(memberTasks);
                const done = completedPoints(memberTasks);
                const remaining = Math.max(0, assigned - done);
                const memberSprintCapacity = getMemberSprintCapacity(activeSprint, member);
                const statusPoints = lanes.map((lane) => ({
                  ...lane,
                  points: sumPoints(memberTasks.filter((task) => task.status === lane.id)),
                }));

                return (
                  <article className="team-card" key={member.id}>
                    <div className="team-card-top">
                      <div className="avatar" style={{ background: member.accent }}>
                        {initials(member.name)}
                      </div>
                      <div>
                        <h2>{member.name}</h2>
                        <p>
                          {member.role} · {statusLabels[member.status]}
                        </p>
                      </div>
                    </div>
                    <div className="team-load-topbar">
                      <div className="team-load-stat">
                        <span className="team-load-stat-label">Assigned</span>
                        <strong>{assigned} pts</strong>
                      </div>
                      <label className="team-load-stat team-load-capacity-stat">
                        <span className="team-load-stat-label">Capacity</span>
                        <div className="team-load-capacity-input">
                          <input
                            type="number"
                            min="0"
                            max="40"
                            value={memberSprintCapacity}
                            disabled={!currentPermissions.manageUsers || !activeSprint}
                            onChange={(event) =>
                              updateSprintMemberCapacity(member.id, Number(event.target.value))
                            }
                            aria-label={`${member.name} sprint capacity`}
                          />
                          <small>pts</small>
                        </div>
                      </label>
                      <div className="team-load-stat">
                        <span className="team-load-stat-label">Remaining</span>
                        <strong>{remaining} pts</strong>
                      </div>
                    </div>
                    <TeamLoadBar
                      assigned={assigned}
                      capacity={memberSprintCapacity}
                      statusPoints={statusPoints}
                    />
                    <div className="team-status-grid" aria-label={`${member.name} status load`}>
                      {statusPoints.map((lane) => (
                        <div className="team-status-card" key={`${member.id}-${lane.id}`}>
                          <span>{lane.label}</span>
                          <strong>{lane.points} pts</strong>
                        </div>
                      ))}
                    </div>
                  </article>
                );
              })}
            </section>
          ) : null}

          {viewMode === "access" ? (
            <section className="access-grid">
              <article className="access-card invite-card">
                <div className="section-title">
                  <MailPlus size={18} />
                  <h2>Provision a teammate</h2>
                </div>
                {!currentPermissions.manageUsers ? (
                  <p className="permission-note">
                    {roleLabels[currentUser.systemRole]} can review workspace access,
                    but only Owners and Admins can invite or edit users.
                  </p>
                ) : null}
                {provisioningNotice ? (
                  <p className="provisioning-note">{provisioningNotice}</p>
                ) : null}
                <form className="invite-form" onSubmit={handleInvite}>
                  <label>
                    Name
                    <input
                      value={inviteDraft.name}
                      disabled={!currentPermissions.manageUsers}
                      onChange={(event) => updateInviteDraft("name", event.target.value)}
                      placeholder="Jordan Rivera"
                    />
                  </label>
                  <label>
                    Email
                    <input
                      type="email"
                      value={inviteDraft.email}
                      disabled={!currentPermissions.manageUsers}
                      onChange={(event) => updateInviteDraft("email", event.target.value)}
                      placeholder="jordan@clairio.com"
                    />
                  </label>
                  <div className="two-col">
                    <label>
                      Job title
                      <input
                        value={inviteDraft.role}
                        disabled={!currentPermissions.manageUsers}
                        onChange={(event) => updateInviteDraft("role", event.target.value)}
                      />
                    </label>
                    <label>
                      Team
                      <input
                        value={inviteDraft.team}
                        disabled={!currentPermissions.manageUsers}
                        onChange={(event) => updateInviteDraft("team", event.target.value)}
                      />
                    </label>
                  </div>
                  <div className="two-col">
                    <label>
                      Access role
                      <SelectField
                        value={inviteDraft.systemRole}
                        disabled={!currentPermissions.manageUsers}
                        onChange={(nextRole) =>
                          updateInviteDraft("systemRole", nextRole as SystemRole)
                        }
                        options={accessRoleOptions}
                      />
                    </label>
                    <label>
                      Project role
                      <SelectField
                        value={inviteDraft.scrumRole}
                        disabled={!currentPermissions.manageUsers}
                        onChange={(nextRole) =>
                          updateInviteDraft("scrumRole", nextRole as ScrumRole)
                        }
                        options={projectRoleOptions}
                      />
                    </label>
                  </div>
                  <button
                    className="primary-button"
                    type="submit"
                    disabled={!currentPermissions.manageUsers}
                  >
                    <MailPlus size={16} />
                    Send invite
                  </button>
                </form>
              </article>

              <article className="access-card permission-card">
                <div className="section-title">
                  <KeyRound size={18} />
                  <h2>Role permissions</h2>
                </div>
                <div className="permission-list">
                  {Object.entries(rolePermissions).map(([role, permissions]) => (
                    <div className="permission-row" key={role}>
                      <h3>{roleLabels[role as SystemRole]}</h3>
                      <ul>
                        {permissions.map((permission) => (
                          <li key={permission}>{permission}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </article>

              <article className="access-card restore-card">
                <div className="section-title">
                  <Undo2 size={18} />
                  <h2>Restore deleted work</h2>
                </div>
                <div className="restore-grid">
                  <div className="restore-column">
                    <h3>Boards</h3>
                    {deletedBoards.length > 0 ? (
                      deletedBoards.map((board) => (
                        <div className="restore-row" key={board.id}>
                          <span>{board.title}</span>
                          <button
                            type="button"
                            disabled={!currentPermissions.manageRoadmap}
                            onClick={() => restoreBoard(board.id)}
                          >
                            Restore
                          </button>
                        </div>
                      ))
                    ) : (
                      <p>No deleted boards.</p>
                    )}
                  </div>
	                  <div className="restore-column">
	                    <h3>Releases</h3>
	                    {deletedReleases.length > 0 ? (
                      deletedReleases.map((release) => (
                        <div className="restore-row" key={release.id}>
                          <span>{release.name}</span>
                          <button
                            type="button"
                            disabled={!currentPermissions.manageRoadmap}
                            onClick={() => restoreRelease(release.id)}
                          >
                            Restore
                          </button>
                        </div>
                      ))
	                    ) : (
	                      <p>No deleted releases.</p>
	                    )}
	                  </div>
	                  <div className="restore-column">
	                    <h3>Epics</h3>
	                    {deletedEpics.length > 0 ? (
	                      deletedEpics.map((epic) => (
	                        <div className="restore-row" key={epic.id}>
	                          <span>{epic.name}</span>
	                          <button
	                            type="button"
	                            disabled={!currentPermissions.manageRoadmap}
	                            onClick={() => restoreEpic(epic.id)}
	                          >
	                            Restore
	                          </button>
	                        </div>
	                      ))
	                    ) : (
	                      <p>No deleted epics.</p>
	                    )}
	                  </div>
	                  <div className="restore-column">
	                    <h3>Sprints</h3>
                    {deletedSprints.length > 0 ? (
                      deletedSprints.map((sprint) => (
                        <div className="restore-row" key={sprint.id}>
                          <span>{sprint.name}</span>
                          <button
                            type="button"
                            disabled={!currentPermissions.manageRoadmap}
                            onClick={() => restoreSprint(sprint.id)}
                          >
                            Restore
                          </button>
                        </div>
                      ))
                    ) : (
                      <p>No deleted sprints.</p>
                    )}
                  </div>
                  <div className="restore-column">
                    <h3>Tasks</h3>
                    {deletedTasks.length > 0 ? (
                      deletedTasks.map((task) => (
                        <div className="restore-row" key={task.id}>
                          <span>{task.title}</span>
                          <button
                            type="button"
                            disabled={!currentPermissions.manageTasks}
                            onClick={() => restoreTask(task.id)}
                          >
                            Restore
                          </button>
                        </div>
                      ))
                    ) : (
                      <p>No deleted tasks.</p>
                    )}
                  </div>
                </div>
              </article>

              <article className="access-card members-card">
                <div className="section-title">
                  <Building2 size={18} />
                  <h2>Workspace members</h2>
                </div>
                <div className="member-table">
                  {members.map((member) => (
                    <div className="member-row" key={member.id}>
                      <div className="avatar" style={{ background: member.accent }}>
                        {initials(member.name)}
                      </div>
                      <div className="member-main">
                        <strong>{member.name}</strong>
                        <span>{member.email}</span>
                        <small>{member.team} · {member.role}</small>
                      </div>
                      <label>
                        Access role
                        <SelectField
                          value={member.systemRole}
                          disabled={!currentPermissions.manageUsers || member.id === currentUser.id}
                          onChange={(nextRole) =>
                            updateMember(member.id, {
                              systemRole: nextRole as SystemRole,
                            })
                          }
                          options={accessRoleOptions}
                        />
                      </label>
                      <label>
                        Project role
                        <SelectField
                          value={member.scrumRole}
                          disabled={!currentPermissions.manageUsers}
                          onChange={(nextRole) =>
                            updateMember(member.id, {
                              scrumRole: nextRole as ScrumRole,
                            })
                          }
                          options={projectRoleOptions}
                        />
                      </label>
                      <div className="member-actions">
                        <span className={`status-pill ${member.status}`}>
                          {statusLabels[member.status]}
                        </span>
                        {member.status === "invited" ? (
                          <button
                            type="button"
                            disabled={!currentPermissions.manageUsers}
                            onClick={() => setMemberStatus(member.id, "active")}
                          >
                            Activate
                          </button>
                        ) : null}
                        {member.status === "active" ? (
                          <button
                            type="button"
                            disabled={
                              !currentPermissions.manageUsers || member.id === currentUser.id
                            }
                            onClick={() => setMemberStatus(member.id, "suspended")}
                          >
                            Suspend
                          </button>
                        ) : null}
                        {member.status === "suspended" ? (
                          <button
                            type="button"
                            disabled={!currentPermissions.manageUsers}
                            onClick={() => setMemberStatus(member.id, "active")}
                          >
                            Restore
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            </section>
          ) : null}
        </section>
      </section>

      <footer className="app-footer">
        <span>Clairio Product Task Manager</span>
        <ArrowRight size={15} aria-hidden="true" />
        <span>Agile planning, Kanban flow, and burndown visibility in one place.</span>
      </footer>
    </main>
  );
}

export default App;
