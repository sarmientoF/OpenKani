import { zValidator } from "@hono/zod-validator";
import {
  and,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
  ne,
  type SQL,
  sql,
} from "drizzle-orm";
import { Hono } from "hono";
import * as schema from "../db/schema";
import { collectionResponse, maxDataUpdatedAt } from "../helpers";
import type { AuthEnv } from "../middleware/auth";
import {
  studyMaterialCreateParamsSchema,
  studyMaterialParamsSchema,
  studyMaterialUpdateBodySchema,
  studyMaterialUpdateParamsSchema,
} from "../schemas/study-materials";
import { toStudyMaterialResponse } from "../transformers";

const app = new Hono<AuthEnv>();

app.get("/", zValidator("query", studyMaterialParamsSchema), async (c) => {
  const db = c.get("db");
  const baseUrl = c.get("baseUrl");
  const { hidden, ids, subject_ids, subject_types, updated_after } =
    c.req.valid("query");

  const conditions: SQL[] = [ne(schema.subject.studyMaterialId, 0)];

  if (hidden === true) conditions.push(isNotNull(schema.subject.hiddenAt));
  else if (hidden === false) conditions.push(isNull(schema.subject.hiddenAt));
  if (ids) conditions.push(inArray(schema.subject.studyMaterialId, ids));
  if (subject_ids) conditions.push(inArray(schema.subject.id, subject_ids));
  if (subject_types)
    conditions.push(inArray(schema.subject.object, subject_types));
  if (updated_after)
    conditions.push(gt(schema.subject.dataUpdatedAt, updated_after.getTime()));

  const rows = await db
    .select()
    .from(schema.subject)
    .where(and(...conditions));
  const data = rows.map((r) => toStudyMaterialResponse(r, baseUrl));

  return c.json(
    collectionResponse(
      data,
      `${baseUrl}/study_materials`,
      undefined,
      maxDataUpdatedAt(rows),
    ),
    200,
  );
});

app.post(
  "/",
  zValidator("json", studyMaterialCreateParamsSchema),
  async (c) => {
    const db = c.get("db");
    const baseUrl = c.get("baseUrl");
    const { subject_id, meaning_note, reading_note, meaning_synonyms } =
      c.req.valid("json");

    const [row] = await db
      .select()
      .from(schema.subject)
      .where(eq(schema.subject.id, subject_id))
      .limit(1);

    if (!row) return c.json({ error: "Subject not found" }, 404);

    const newId =
      row.studyMaterialId ||
      (
        await db
          .select({
            maxId: sql<number>`MAX(${schema.subject.studyMaterialId})`,
          })
          .from(schema.subject)
      )[0].maxId + 1;

    await db
      .update(schema.subject)
      .set({
        studyMaterialId: newId,
        meaningNote: meaning_note ?? null,
        readingNote: reading_note ?? null,
        meaningSynonyms: JSON.stringify(meaning_synonyms ?? []),
        studyMaterialPatched: 1,
        dataUpdatedAt: Date.now(),
      })
      .where(eq(schema.subject.id, subject_id));

    const [updated] = await db
      .select()
      .from(schema.subject)
      .where(eq(schema.subject.id, subject_id))
      .limit(1);

    return c.json(toStudyMaterialResponse(updated, baseUrl), 201);
  },
);

app.put(
  "/:id",
  zValidator("param", studyMaterialUpdateParamsSchema),
  zValidator("json", studyMaterialUpdateBodySchema),
  async (c) => {
    const db = c.get("db");
    const baseUrl = c.get("baseUrl");
    const { id } = c.req.valid("param");
    const { meaning_note, reading_note, meaning_synonyms } =
      c.req.valid("json");

    const setFields: Partial<typeof schema.subject.$inferInsert> = {};
    if (meaning_note !== undefined) setFields.meaningNote = meaning_note;
    if (reading_note !== undefined) setFields.readingNote = reading_note;
    if (meaning_synonyms !== undefined)
      setFields.meaningSynonyms = JSON.stringify(meaning_synonyms);
    setFields.studyMaterialPatched = 1;
    setFields.dataUpdatedAt = Date.now();

    await db
      .update(schema.subject)
      .set(setFields)
      .where(eq(schema.subject.studyMaterialId, id));

    const [updated] = await db
      .select()
      .from(schema.subject)
      .where(eq(schema.subject.studyMaterialId, id))
      .limit(1);

    if (!updated) return c.json({ error: "Study material not found" }, 404);

    return c.json(toStudyMaterialResponse(updated, baseUrl), 200);
  },
);

export default app;
