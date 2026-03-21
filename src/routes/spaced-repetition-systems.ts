import { zValidator } from "@hono/zod-validator";
import { and, inArray, type SQL } from "drizzle-orm";
import { Hono } from "hono";
import * as schema from "../db/schema";
import { collectionResponse } from "../helpers";
import type { AuthEnv } from "../middleware/auth";
import { spacedRepetitionParamsSchema } from "../schemas/spaced-repetition-systems";
import { toSrsSystemResponse } from "../transformers";

const app = new Hono<AuthEnv>();

app.get("/", zValidator("query", spacedRepetitionParamsSchema), async (c) => {
  const db = c.get("db");
  const baseUrl = c.get("baseUrl");
  const { ids } = c.req.valid("query");

  const conditions: SQL[] = [];
  if (ids) conditions.push(inArray(schema.srsSystem.id, ids));

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const rows = await db.select().from(schema.srsSystem).where(where);
  const data = rows.map((r) => toSrsSystemResponse(r, baseUrl));

  return c.json(
    collectionResponse(data, `${baseUrl}/spaced_repetition_systems`),
    200,
  );
});

export default app;
