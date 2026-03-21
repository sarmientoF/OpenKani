import { zValidator } from "@hono/zod-validator";
import { and, gt, inArray, type SQL } from "drizzle-orm";
import { Hono } from "hono";
import * as schema from "../db/schema";
import { collectionResponse, maxDataUpdatedAt } from "../helpers";
import type { AuthEnv } from "../middleware/auth";
import { levelProgressionParamsSchema } from "../schemas/level-progressions";
import { toLevelProgressionResponse } from "../transformers";

const app = new Hono<AuthEnv>();

app.get("/", zValidator("query", levelProgressionParamsSchema), async (c) => {
  const db = c.get("db");
  const baseUrl = c.get("baseUrl");
  const { ids, updated_after } = c.req.valid("query");

  const conditions: SQL[] = [];
  if (ids) conditions.push(inArray(schema.levelProgression.id, ids));
  if (updated_after)
    conditions.push(
      gt(schema.levelProgression.dataUpdatedAt, updated_after.getTime()),
    );

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const rows = await db.select().from(schema.levelProgression).where(where);
  const data = rows.map((r) => toLevelProgressionResponse(r, baseUrl));

  return c.json(
    collectionResponse(
      data,
      `${baseUrl}/level_progressions`,
      undefined,
      maxDataUpdatedAt(rows),
    ),
    200,
  );
});

export default app;
