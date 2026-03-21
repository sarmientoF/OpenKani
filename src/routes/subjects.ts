import { zValidator } from "@hono/zod-validator";
import {
  and,
  asc,
  count,
  gt,
  inArray,
  isNotNull,
  isNull,
  lt,
  type SQL,
} from "drizzle-orm";
import { Hono } from "hono";
import * as schema from "../db/schema";
import { collectionResponse, maxDataUpdatedAt } from "../helpers";
import type { AuthEnv } from "../middleware/auth";
import { subjectParametersSchema } from "../schemas/subjects";
import { toSubjectResponse } from "../transformers";

const app = new Hono<AuthEnv>();

app.get("/", zValidator("query", subjectParametersSchema), async (c) => {
  const db = c.get("db");
  const baseUrl = c.get("baseUrl");
  const {
    ids,
    types,
    slugs,
    levels,
    hidden,
    updated_after,
    page_after_id,
    page_before_id,
  } = c.req.valid("query");

  const LIMIT = 1000;

  // Filter conditions (excluding pagination cursors)
  const filterConditions: SQL[] = [];
  if (ids) filterConditions.push(inArray(schema.subject.id, ids));
  if (types) filterConditions.push(inArray(schema.subject.object, types));
  if (slugs) filterConditions.push(inArray(schema.subject.slug, slugs));
  if (levels) filterConditions.push(inArray(schema.subject.level, levels));
  if (hidden === true)
    filterConditions.push(isNotNull(schema.subject.hiddenAt));
  else if (hidden === false)
    filterConditions.push(isNull(schema.subject.hiddenAt));
  if (updated_after)
    filterConditions.push(
      gt(schema.subject.dataUpdatedAt, updated_after.getTime()),
    );

  // Pagination cursor conditions
  const pageConditions: SQL[] = [...filterConditions];
  if (page_after_id) pageConditions.push(gt(schema.subject.id, page_after_id));
  if (page_before_id)
    pageConditions.push(lt(schema.subject.id, page_before_id));

  const filterWhere =
    filterConditions.length > 0 ? and(...filterConditions) : undefined;
  const pageWhere =
    pageConditions.length > 0 ? and(...pageConditions) : undefined;

  const [rows, [{ totalCount }]] = await Promise.all([
    db
      .select()
      .from(schema.subject)
      .where(pageWhere)
      .orderBy(asc(schema.subject.id))
      .limit(LIMIT + 1),
    db.select({ totalCount: count() }).from(schema.subject).where(filterWhere),
  ]);

  let hasNextPage = false;
  if (rows.length > LIMIT) {
    hasNextPage = true;
    rows.pop();
  }

  const subjects = rows.map((r) => toSubjectResponse(r, baseUrl));

  const dataUpdatedAt = maxDataUpdatedAt(rows);

  // Preserve all filter params in pagination URLs
  const filterParams = [
    ids ? `ids=${ids.join(",")}` : "",
    types ? `types=${types.join(",")}` : "",
    slugs ? `slugs=${slugs.join(",")}` : "",
    levels ? `levels=${levels.join(",")}` : "",
    hidden != null ? `hidden=${hidden}` : "",
    updated_after ? `updated_after=${updated_after.toISOString()}` : "",
  ]
    .filter(Boolean)
    .join("&");
  const filterSuffix = filterParams ? `&${filterParams}` : "";

  return c.json(
    collectionResponse(
      subjects,
      `${baseUrl}/subjects`,
      {
        per_page: subjects.length,
        next_url: hasNextPage
          ? `${baseUrl}/subjects?page_after_id=${rows.at(-1)!.id}${filterSuffix}`
          : null,
        previous_url:
          rows.length && page_after_id
            ? `${baseUrl}/subjects?page_before_id=${rows[0].id}${filterSuffix}`
            : null,
      },
      dataUpdatedAt,
      totalCount,
    ),
    200,
  );
});

export default app;
