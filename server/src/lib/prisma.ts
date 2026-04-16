import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var clairioPrisma: PrismaClient | undefined;
}

export const prisma =
  globalThis.clairioPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.clairioPrisma = prisma;
}
