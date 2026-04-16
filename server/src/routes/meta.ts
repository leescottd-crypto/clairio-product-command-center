import { Router } from "express";
import {
  accessRoleValues,
  boardTemplateValues,
  boardVisibilityValues,
  memberStatusValues,
  priorityValues,
  scrumRoleValues,
  storyPointValues,
  taskStatusValues,
  taskTypeValues,
} from "../../../src/shared/domain";

export function createMetaRouter() {
  const router = Router();

  router.get("/domain", (_request, response) => {
    response.json({
      application: "Clairio Product Command Center",
      workflow: {
        taskStatuses: taskStatusValues,
        priorities: priorityValues,
        taskTypes: taskTypeValues,
        storyPoints: storyPointValues,
      },
      access: {
        systemRoles: accessRoleValues,
        scrumRoles: scrumRoleValues,
        memberStatuses: memberStatusValues,
      },
      boards: {
        visibility: boardVisibilityValues,
        templates: boardTemplateValues,
      },
    });
  });

  return router;
}
