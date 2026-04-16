import cors from "cors";
import express from "express";
import { createHealthRouter } from "./routes/health";
import { createMetaRouter } from "./routes/meta";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use(
    cors({
      origin: true,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "2mb" }));

  app.get("/", (_request, response) => {
    response.json({
      service: "clairio-api",
      message: "Backend foundation is running.",
    });
  });

  app.use("/health", createHealthRouter());
  app.use("/api/meta", createMetaRouter());

  app.use((_request, response) => {
    response.status(404).json({
      error: "not_found",
      message: "Route not found.",
    });
  });

  return app;
}
