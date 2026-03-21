import { createClient } from "@libsql/client";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { users } from "../db/registry-schema";
import { env } from "../env";

const client = createClient({
  url: `libsql://${env.TURSO_REGISTRY_DATABASE_NAME}-${env.TURSO_ORG}.turso.io`,
  authToken: env.TURSO_GROUP_AUTH_TOKEN,
});

const db = drizzle(client);

export async function registerUser(userId: string): Promise<string> {
  const [existing] = await db
    .select({ token: users.token })
    .from(users)
    .where(eq(users.userId, userId));
  if (existing) return existing.token;

  const token = crypto.randomUUID();
  await db.insert(users).values({ token, userId, createdAt: Date.now() });
  return token;
}

export async function lookupToken(token: string): Promise<string | null> {
  const [row] = await db
    .select({ userId: users.userId })
    .from(users)
    .where(eq(users.token, token));
  return row?.userId ?? null;
}
