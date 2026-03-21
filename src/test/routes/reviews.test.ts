import { beforeEach, describe, expect, test } from "bun:test";
import type { Hono } from "hono";
import type { AuthEnv } from "../../middleware/auth";
import {
  createTestApp,
  createTestDb,
  seedLevel,
  seedLevelProgression,
  seedSrsSystem,
  seedSubject,
  type TestDb,
} from "../setup";

const epoch = (iso: string) => new Date(iso).getTime();

describe("GET /reviews", () => {
  let app: Hono<AuthEnv>;

  beforeEach(() => {
    const db = createTestDb();
    app = createTestApp(db);
  });

  test("returns empty collection", async () => {
    const res = await app.request(new Request("http://localhost/v2/reviews"));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.object).toBe("collection");
    expect(json.total_count).toBe(0);
  });
});

describe("POST /reviews", () => {
  let db: TestDb;
  let app: Hono<AuthEnv>;

  beforeEach(() => {
    db = createTestDb();
    app = createTestApp(db);
    seedSrsSystem(db);
    seedLevel(db, 1);
    seedLevelProgression(db, 1, 1, { startedAt: Date.now() });

    seedSubject(db, {
      id: 8,
      object: "radical",
      srsSystemId: 2,
      level: 1,
      assignmentId: 100,
      srsStage: 3,
      unlockedAt: epoch("2025-01-01T00:00:00Z"),
      startedAt: epoch("2025-01-01T01:00:00Z"),
      availableAt: epoch("2025-05-08T01:00:00Z"),
      reviewStatisticId: 500,
      meaningCorrect: 3,
      readingCorrect: 3,
    });
  });

  test("returns 201 with review object", async () => {
    const res = await app.request(
      new Request("http://localhost/v2/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          review: {
            subject_id: 8,
            incorrect_meaning_answers: 0,
            incorrect_reading_answers: 0,
          },
        }),
      }),
    );

    expect(res.status).toBe(201);
    const json = await res.json();

    expect(json.object).toBe("review");
    expect(json.data.subject_id).toBe(8);
    expect(json.data.starting_srs_stage).toBe(3);
    expect(json.data.ending_srs_stage).toBe(4);
    expect(json.resources_updated.assignment).toBeDefined();
    expect(json.resources_updated.review_statistic).toBeDefined();
  });

  test("handles incorrect answers", async () => {
    const res = await app.request(
      new Request("http://localhost/v2/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          review: {
            subject_id: 8,
            incorrect_meaning_answers: 1,
            incorrect_reading_answers: 1,
          },
        }),
      }),
    );

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.starting_srs_stage).toBe(3);
    expect(json.data.ending_srs_stage).toBe(2); // ceil(2/2)=1, 3-1=2
  });

  test("returns error for missing subject", async () => {
    const res = await app.request(
      new Request("http://localhost/v2/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          review: {
            subject_id: 999,
            incorrect_meaning_answers: 0,
            incorrect_reading_answers: 0,
          },
        }),
      }),
    );

    expect(res.status).toBe(500);
  });
});
