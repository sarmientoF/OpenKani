import { zValidator } from "@hono/zod-validator";
import {
  and,
  gt,
  inArray,
  isNotNull,
  isNull,
  lt,
  ne,
  type SQL,
} from "drizzle-orm";
import { Hono } from "hono";
import * as schema from "../db/schema";
import { collectionResponse, maxDataUpdatedAt } from "../helpers";
import type { AuthEnv } from "../middleware/auth";
import { reviewStatisticsParamsSchema } from "../schemas/review-statistics";
import { toReviewStatResponse } from "../transformers";

const app = new Hono<AuthEnv>();

app.get("/", zValidator("query", reviewStatisticsParamsSchema), async (c) => {
  const db = c.get("db");
  const baseUrl = c.get("baseUrl");
  const {
    hidden,
    ids,
    percentages_greater_than,
    percentages_less_than,
    subject_ids,
    subject_types,
    updated_after,
  } = c.req.valid("query");

  const conditions: SQL[] = [ne(schema.subject.reviewStatisticId, 0)];

  if (hidden === true) conditions.push(isNotNull(schema.subject.hiddenAt));
  else if (hidden === false) conditions.push(isNull(schema.subject.hiddenAt));
  if (ids) conditions.push(inArray(schema.subject.reviewStatisticId, ids));
  if (percentages_greater_than != null)
    conditions.push(
      gt(schema.subject.percentageCorrect, percentages_greater_than),
    );
  if (percentages_less_than != null)
    conditions.push(
      lt(schema.subject.percentageCorrect, percentages_less_than),
    );
  if (subject_ids) conditions.push(inArray(schema.subject.id, subject_ids));
  if (subject_types)
    conditions.push(inArray(schema.subject.object, subject_types));
  if (updated_after)
    conditions.push(gt(schema.subject.dataUpdatedAt, updated_after.getTime()));

  const rows = await db
    .select()
    .from(schema.subject)
    .where(and(...conditions));
  const data = rows.map((r) => toReviewStatResponse(r, baseUrl));

  return c.json(
    collectionResponse(
      data,
      `${baseUrl}/review_statistics`,
      undefined,
      maxDataUpdatedAt(rows),
    ),
    200,
  );
});

export default app;
