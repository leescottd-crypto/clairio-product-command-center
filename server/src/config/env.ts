import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().optional(),
  DIRECT_URL: z.string().optional(),
  BLOB_BASE_URL: z.string().url().optional(),
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
});

export type ServerEnv = z.infer<typeof envSchema>;

export function readEnv(): ServerEnv {
  return envSchema.parse(process.env);
}
