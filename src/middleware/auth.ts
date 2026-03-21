import { createMiddleware } from "hono/factory";
import { getBaseUrl } from "../helpers";
import { lookupToken } from "../services/registry.service";
import { getUserDb, type UserDb } from "../services/turso.service";

export type AuthEnv = {
  Variables: { db: UserDb; userId: string; baseUrl: string };
};

export const authMiddleware = createMiddleware<AuthEnv>(async (c, next) => {
  const header = c.req.header("Authorization");
  let token: string | undefined;
  if (header?.startsWith("Bearer ")) {
    token = header.slice(7);
  } else if (header?.startsWith("Token token=")) {
    token = header.slice(12);
  }
  if (!token) {
    return c.json({ error: "Missing Authorization header" }, 401);
  }
  const userId = await lookupToken(token);
  if (!userId) {
    return c.json({ error: "Invalid token" }, 401);
  }
  c.set("db", await getUserDb(userId));
  c.set("userId", userId);
  c.set("baseUrl", getBaseUrl(c.req.url));
  await next();
});
