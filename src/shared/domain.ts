export const accessRoleValues = ["owner", "admin", "contributor", "viewer"] as const;
export const scrumRoleValues = [
  "product_owner",
  "scrum_master",
  "engineer",
  "designer",
  "qa_release",
  "stakeholder",
  "observer",
] as const;
export const taskStatusValues = [
  "backlog",
  "ready",
  "progress",
  "testing",
  "blocked",
  "done",
] as const;
export const priorityValues = ["low", "medium", "high", "critical"] as const;
export const taskTypeValues = ["story", "bug", "chore", "spike", "debt"] as const;
export const storyPointValues = [0, 1, 2, 3, 5, 8, 13, 21] as const;
export const boardVisibilityValues = ["private", "workspace", "organization", "public"] as const;
export const boardTemplateValues = ["blank", "kanban", "scrum", "release"] as const;
export const memberStatusValues = ["invited", "active", "suspended", "deactivated"] as const;

export type TaskStatus = (typeof taskStatusValues)[number];
export type Priority = (typeof priorityValues)[number];
export type TaskType = (typeof taskTypeValues)[number];
export type StoryPoints = (typeof storyPointValues)[number];
export type BoardVisibility = (typeof boardVisibilityValues)[number];
export type BoardTemplate = (typeof boardTemplateValues)[number];
export type MemberStatus = (typeof memberStatusValues)[number];
export type SystemRole = (typeof accessRoleValues)[number];
export type ScrumRole = (typeof scrumRoleValues)[number];

export type DeletedMeta = {
  deletedAt?: string;
  deletedBy?: string;
};

export type SprintMemberCapacities = Record<string, number>;

export type WorkspaceMember = {
  id: string;
  name: string;
  email: string;
  role: string;
  systemRole: SystemRole;
  scrumRole: ScrumRole;
  status: MemberStatus;
  team: string;
  capacity: number;
  accent: string;
  invitedOn: string;
  lastActive: string;
};

export type InviteDraft = {
  name: string;
  email: string;
  role: string;
  systemRole: SystemRole;
  scrumRole: ScrumRole;
  team: string;
  capacity: number;
};

export type Epic = DeletedMeta & {
  id: string;
  name: string;
  ownerId: string;
  releaseId: string;
  goal: string;
};

export type Release = DeletedMeta & {
  id: string;
  name: string;
  goal: string;
  startDate: string;
  endDate: string;
};

export type Sprint = DeletedMeta & {
  id: string;
  name: string;
  goal: string;
  releaseId: string;
  startDate: string;
  endDate: string;
  capacity: number;
  memberCapacities: SprintMemberCapacities;
};

export type WorkspaceBoard = DeletedMeta & {
  id: string;
  title: string;
  workspace: string;
  visibility: BoardVisibility;
  background: string;
  template: BoardTemplate;
  description: string;
  createdOn: string;
  starred: boolean;
};

export type TaskAttachment = {
  id: string;
  name: string;
  type: string;
  size: number;
  createdAt: string;
  createdBy: string;
};

export type ProductTask = DeletedMeta & {
  id: string;
  boardId: string;
  title: string;
  assigneeId: string;
  type: TaskType;
  status: TaskStatus;
  priority: Priority;
  points: StoryPoints;
  epicId: string;
  releaseId: string;
  sprintId: string;
  dueDate: string;
  completedOn: string;
  acceptance: string;
  notes: string;
  attachments: TaskAttachment[];
};

export type TaskDraft = Omit<ProductTask, "id" | "completedOn" | "deletedAt" | "deletedBy">;
export type EpicDraft = Omit<Epic, "id">;
export type ReleaseDraft = Omit<Release, "id" | "deletedAt" | "deletedBy">;
export type SprintDraft = Omit<Sprint, "id" | "deletedAt" | "deletedBy">;
export type BoardDraft = Omit<WorkspaceBoard, "id" | "createdOn" | "starred" | "deletedAt" | "deletedBy">;
