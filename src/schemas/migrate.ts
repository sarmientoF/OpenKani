import { z } from "zod";

export const migrateBodySchema = z.object({
  wanikani_api_key: z.string().min(1),
});

export const migrateQuerySchema = z.object({
  force: z
    .string()
    .optional()
    .transform((v) => v === "true"),
});
