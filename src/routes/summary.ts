import { add, addHours, max, startOfHour } from "date-fns";
import { and, asc, isNotNull, isNull, lte, ne } from "drizzle-orm";
import { Hono } from "hono";
import * as schema from "../db/schema";
import type { AuthEnv } from "../middleware/auth";

const app = new Hono<AuthEnv>();

app.get("/", async (c) => {
  const db = c.get("db");
  const baseUrl = c.get("baseUrl");
  const now = new Date();
  const start = startOfHour(now);
  const startEpoch = start.getTime();
  const endEpoch = startOfHour(addHours(now, 24)).getTime();

  const lessonRows = await db
    .select({ id: schema.subject.id })
    .from(schema.subject)
    .where(
      and(
        ne(schema.subject.assignmentId, 0),
        isNotNull(schema.subject.unlockedAt),
        lte(schema.subject.unlockedAt, startEpoch),
        isNull(schema.subject.startedAt),
        isNull(schema.subject.burnedAt),
      ),
    );

  const reviewRows = await db
    .select({
      id: schema.subject.id,
      availableAt: schema.subject.availableAt,
    })
    .from(schema.subject)
    .where(
      and(
        ne(schema.subject.assignmentId, 0),
        isNotNull(schema.subject.availableAt),
        lte(schema.subject.availableAt, endEpoch),
      ),
    )
    .orderBy(asc(schema.subject.availableAt));

  const groupedReviews: Record<string, number[]> = {};
  for (const row of reviewRows) {
    const hourKey = max([
      start,
      startOfHour(new Date(row.availableAt!)),
    ]).toISOString();
    if (!groupedReviews[hourKey]) groupedReviews[hourKey] = [];
    groupedReviews[hourKey].push(row.id);
  }

  for (let i = 0; i < 25; i++) {
    const hourKey = add(start, { hours: i }).toISOString();
    groupedReviews[hourKey] ??= [];
  }

  const finalReviews = Object.entries(groupedReviews)
    .map(([availableAt, subject_ids]) => ({
      available_at: new Date(availableAt),
      subject_ids,
    }))
    .sort((a, b) => a.available_at.getTime() - b.available_at.getTime());

  return c.json(
    {
      object: "report",
      url: `${baseUrl}/summary`,
      data_updated_at: start,
      data: {
        lessons: [
          {
            available_at: start,
            subject_ids: lessonRows.map((l) => l.id),
          },
        ],
        reviews: finalReviews,
        next_reviews_at:
          finalReviews.find((r) => r.subject_ids.length > 0)?.available_at ??
          null,
      },
    },
    200,
  );
});

export default app;
