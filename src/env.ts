import { z } from "zod";

const schema = z.object({
  TURSO_API_TOKEN: z.string().min(1),
  TURSO_ORG: z.string().min(1),
  TURSO_DATABASE_NAME: z.string().min(1),
  TURSO_REGISTRY_DATABASE_NAME: z.string().min(1),
  TURSO_GROUP: z.string().min(1),
  TURSO_GROUP_AUTH_TOKEN: z.string().min(1),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
  throw new Error(`Missing env vars: ${missing}`);
}

export const env = parsed.data;
