import {
  afterEach,
  beforeEach,
  describe,
  expect,
  setSystemTime,
  test,
} from "bun:test";
import { startOfHour } from "date-fns";
import type { Hono } from "hono";
import type { AuthEnv } from "../middleware/auth";
import {
  createTestApp,
  createTestDb,
  seedLevel,
  seedSrsSystem,
  seedSubject,
  type TestDb,
} from "./setup";

const NOW = new Date("2025-06-15T14:30:00Z");
const HOUR_START = startOfHour(NOW).getTime();

function req() {
  return new Request("http://localhost/v2/summary");
}

describe("GET /summary", () => {
  let db: TestDb;
  let app: Hono<AuthEnv>;

  beforeEach(() => {
    setSystemTime(NOW);
    db = createTestDb();
    app = createTestApp(db);
    seedSrsSystem(db);
    seedLevel(db, 1);
  });

  afterEach(() => {
    setSystemTime();
  });

  test("returns lessons matching all 5 conditions", async () => {
    // Valid lesson: assignmentId!=0, unlockedAt<=startOfHour, startedAt=null, burnedAt=null
    seedSubject(db, {
      id: 1,
      object: "radical",
      srsSystemId: 2,
      level: 1,
      assignmentId: 100,
      srsStage: 0,
      unlockedAt: HOUR_START - 3600_000,
    });
    // Excluded: assignmentId=0
    seedSubject(db, {
      id: 2,
      object: "radical",
      srsSystemId: 2,
      level: 1,
      assignmentId: 0,
      srsStage: 0,
      unlockedAt: HOUR_START - 3600_000,
    });
    // Excluded: unlockedAt=null
    seedSubject(db, {
      id: 3,
      object: "radical",
      srsSystemId: 2,
      level: 1,
      assignmentId: 101,
      srsStage: 0,
    });
    // Excluded: unlockedAt in future
    seedSubject(db, {
      id: 4,
      object: "radical",
      srsSystemId: 2,
      level: 1,
      assignmentId: 102,
      srsStage: 0,
      unlockedAt: HOUR_START + 3600_000,
    });
    // Excluded: already started
    seedSubject(db, {
      id: 5,
      object: "radical",
      srsSystemId: 2,
      level: 1,
      assignmentId: 103,
      srsStage: 1,
      unlockedAt: HOUR_START - 3600_000,
      startedAt: HOUR_START - 1800_000,
    });
    // Excluded: burned
    seedSubject(db, {
      id: 6,
      object: "radical",
      srsSystemId: 2,
      level: 1,
      assignmentId: 104,
      srsStage: 9,
      unlockedAt: HOUR_START - 3600_000,
      burnedAt: HOUR_START - 1000,
    });

    const res = await app.request(req());
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.data.lessons).toHaveLength(1);
    expect(json.data.lessons[0].subject_ids).toEqual([1]);
  });

  test("groups reviews into hourly buckets", async () => {
    // Review available in current hour
    seedSubject(db, {
      id: 10,
      object: "kanji",
      srsSystemId: 2,
      level: 1,
      assignmentId: 200,
      srsStage: 3,
      unlockedAt: HOUR_START - 86400_000,
      startedAt: HOUR_START - 86400_000,
      availableAt: HOUR_START + 600_000, // 10 min into current hour
    });
    // Review available 2 hours from now
    const twoHoursLater = HOUR_START + 2 * 3600_000 + 900_000;
    seedSubject(db, {
      id: 11,
      object: "kanji",
      srsSystemId: 2,
      level: 1,
      assignmentId: 201,
      srsStage: 4,
      unlockedAt: HOUR_START - 86400_000,
      startedAt: HOUR_START - 86400_000,
      availableAt: twoHoursLater,
    });

    const res = await app.request(req());
    const json = await res.json();

    // Should have 25 hourly buckets
    expect(json.data.reviews.length).toBe(25);

    // First bucket (current hour) should contain subject 10
    const currentBucket = json.data.reviews[0];
    expect(currentBucket.subject_ids).toContain(10);

    // Bucket at +2h should contain subject 11
    const hour2Key = startOfHour(new Date(twoHoursLater)).toISOString();
    const bucket2 = json.data.reviews.find(
      (r: { available_at: string }) =>
        new Date(r.available_at).toISOString() === hour2Key,
    );
    expect(bucket2).toBeDefined();
    expect(bucket2.subject_ids).toContain(11);
  });

  test("past-hour reviews go into 'now' bucket", async () => {
    // Available 30 min ago (before current hour start)
    seedSubject(db, {
      id: 20,
      object: "radical",
      srsSystemId: 2,
      level: 1,
      assignmentId: 300,
      srsStage: 2,
      unlockedAt: HOUR_START - 86400_000,
      startedAt: HOUR_START - 86400_000,
      availableAt: HOUR_START - 1800_000,
    });

    const res = await app.request(req());
    const json = await res.json();

    // Should be in the first bucket (current hour)
    expect(json.data.reviews[0].subject_ids).toContain(20);
  });

  test("next_reviews_at is first non-empty bucket", async () => {
    const futureAt = HOUR_START + 3 * 3600_000 + 100_000;
    seedSubject(db, {
      id: 30,
      object: "kanji",
      srsSystemId: 2,
      level: 1,
      assignmentId: 400,
      srsStage: 5,
      unlockedAt: HOUR_START - 86400_000,
      startedAt: HOUR_START - 86400_000,
      availableAt: futureAt,
    });

    const res = await app.request(req());
    const json = await res.json();

    const expectedHour = startOfHour(new Date(futureAt)).toISOString();
    expect(new Date(json.data.next_reviews_at).toISOString()).toBe(
      expectedHour,
    );
  });

  test("next_reviews_at is null when no reviews", async () => {
    const res = await app.request(req());
    const json = await res.json();

    expect(json.data.next_reviews_at).toBeNull();
  });

  test("response shape matches WaniKani format", async () => {
    const res = await app.request(req());
    const json = await res.json();

    expect(json.object).toBe("report");
    expect(json.url).toBe("http://localhost/v2/summary");
    expect(json.data).toHaveProperty("lessons");
    expect(json.data).toHaveProperty("reviews");
    expect(json.data).toHaveProperty("next_reviews_at");
  });
});
