import { zValidator } from "@hono/zod-validator";
import {
  and,
  gt,
  gte,
  inArray,
  isNotNull,
  isNull,
  lte,
  ne,
  type SQL,
} from "drizzle-orm";
import { Hono } from "hono";
import * as schema from "../db/schema";
import { collectionResponse, maxDataUpdatedAt } from "../helpers";
import type { AuthEnv } from "../middleware/auth";
import {
  assignmentQuerySchema,
  assignmentStartBodySchema,
  assignmentStartParamSchema,
} from "../schemas/assignments";
import { TursoReviewService } from "../services/review.service";
import { toAssignmentResponse } from "../transformers";

const app = new Hono<AuthEnv>();

app.get("/", zValidator("query", assignmentQuerySchema), async (c) => {
  const db = c.get("db");
  const baseUrl = c.get("baseUrl");
  const {
    available_after,
    available_before,
    burned,
    hidden,
    ids,
    immediately_available_for_lessons,
    immediately_available_for_review,
    levels,
    srs_stages,
    started,
    subject_ids,
    subject_types,
    unlocked,
    updated_after,
  } = c.req.valid("query");

  const conditions: SQL[] = [ne(schema.subject.assignmentId, 0)];

  if (available_after)
    conditions.push(gte(schema.subject.availableAt, available_after.getTime()));
  if (available_before)
    conditions.push(
      lte(schema.subject.availableAt, available_before.getTime()),
    );
  if (burned === true) conditions.push(isNotNull(schema.subject.burnedAt));
  else if (burned === false) conditions.push(isNull(schema.subject.burnedAt));
  if (hidden === true) conditions.push(isNotNull(schema.subject.hiddenAt));
  else if (hidden === false) conditions.push(isNull(schema.subject.hiddenAt));
  if (ids) conditions.push(inArray(schema.subject.assignmentId, ids));
  if (immediately_available_for_lessons) {
    conditions.push(isNotNull(schema.subject.unlockedAt));
    conditions.push(isNull(schema.subject.startedAt));
  }
  if (immediately_available_for_review) {
    conditions.push(isNotNull(schema.subject.startedAt));
    conditions.push(lte(schema.subject.availableAt, Date.now()));
  }
  if (levels) conditions.push(inArray(schema.subject.level, levels));
  if (srs_stages) conditions.push(inArray(schema.subject.srsStage, srs_stages));
  if (started === true) conditions.push(isNotNull(schema.subject.startedAt));
  else if (started === false) conditions.push(isNull(schema.subject.startedAt));
  if (subject_ids) conditions.push(inArray(schema.subject.id, subject_ids));
  if (subject_types)
    conditions.push(inArray(schema.subject.object, subject_types));
  if (unlocked === true) conditions.push(isNotNull(schema.subject.unlockedAt));
  else if (unlocked === false)
    conditions.push(isNull(schema.subject.unlockedAt));
  if (updated_after)
    conditions.push(gt(schema.subject.dataUpdatedAt, updated_after.getTime()));

  const rows = await db
    .select()
    .from(schema.subject)
    .where(and(...conditions));
  const data = rows.map((r) => toAssignmentResponse(r, baseUrl));

  return c.json(
    collectionResponse(
      data,
      `${baseUrl}/assignments`,
      undefined,
      maxDataUpdatedAt(rows),
    ),
    200,
  );
});

app.put(
  "/:id/start",
  zValidator("param", assignmentStartParamSchema),
  zValidator("json", assignmentStartBodySchema),
  async (c) => {
    const db = c.get("db");
    const baseUrl = c.get("baseUrl");
    const { id } = c.req.valid("param");
    const startBody = c.req.valid("json");
    const reviewService = new TursoReviewService(db);

    const { subject } = await reviewService.startAssignment(startBody, id);
    if (!subject) return c.json({ error: "Assignment not found" }, 404);

    return c.json(toAssignmentResponse(subject, baseUrl), 200);
  },
);

export default app;
