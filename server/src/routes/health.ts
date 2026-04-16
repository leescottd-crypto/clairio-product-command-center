import { Router } from "express";
import { readEnv } from "../config/env";

export function createHealthRouter() {
  const router = Router();

  router.get("/", (_request, response) => {
    const env = readEnv();

    response.json({
      status: "ok",
      service: "clairio-api",
      environment: env.NODE_ENV,
      databaseConfigured: Boolean(env.DATABASE_URL),
      documentStorageConfigured: Boolean(env.BLOB_BASE_URL && env.BLOB_READ_WRITE_TOKEN),
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}
