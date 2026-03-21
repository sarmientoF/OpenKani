import { beforeEach, describe, expect, test } from "bun:test";
import type { Hono } from "hono";
import type { AuthEnv } from "../../middleware/auth";
import {
  createTestApp,
  createTestDb,
  seedLevel,
  seedSrsSystem,
  seedSubject,
  type TestDb,
} from "../setup";

const epoch = (iso: string) => new Date(iso).getTime();

function get(path: string) {
  return new Request(`http://localhost/v2${path}`);
}

describe("GET /subjects", () => {
  let db: TestDb;
  let app: Hono<AuthEnv>;

  beforeEach(() => {
    db = createTestDb();
    app = createTestApp(db);
    seedSrsSystem(db);
    seedLevel(db, 1);

    seedSubject(db, {
      id: 1,
      object: "radical",
      srsSystemId: 2,
      level: 1,
      assignmentId: 100,
      srsStage: 5,
      slug: "ground",
      unlockedAt: epoch("2025-01-01T00:00:00Z"),
      dataUpdatedAt: epoch("2025-06-01T00:00:00Z"),
    });
    seedSubject(db, {
      id: 2,
      object: "kanji",
      srsSystemId: 2,
      level: 1,
      assignmentId: 200,
      srsStage: 3,
      slug: "one",
      unlockedAt: epoch("2025-01-01T00:00:00Z"),
      dataUpdatedAt: epoch("2025-07-01T00:00:00Z"),
    });
    seedSubject(db, {
      id: 3,
      object: "vocabulary",
      srsSystemId: 2,
      level: 2,
      assignmentId: 300,
      srsStage: 1,
      slug: "one-thing",
      unlockedAt: epoch("2025-01-01T00:00:00Z"),
      dataUpdatedAt: epoch("2025-08-01T00:00:00Z"),
    });
  });

  test("returns all subjects with no filters", async () => {
    const res = await app.request(get("/subjects"));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.object).toBe("collection");
    expect(json.total_count).toBe(3);
  });

  test("filters by ids", async () => {
    const res = await app.request(get("/subjects?ids=1,2"));
    const json = await res.json();
    expect(json.total_count).toBe(2);
  });

  test("filters by types", async () => {
    const res = await app.request(get("/subjects?types=kanji"));
    const json = await res.json();
    expect(json.total_count).toBe(1);
    expect(json.data[0].object).toBe("kanji");
  });

  test("filters by levels", async () => {
    const res = await app.request(get("/subjects?levels=2"));
    const json = await res.json();
    expect(json.total_count).toBe(1);
    expect(json.data[0].id).toBe(3);
  });

  test("filters by slugs", async () => {
    const res = await app.request(get("/subjects?slugs=ground,one"));
    const json = await res.json();
    expect(json.total_count).toBe(2);
  });

  test("cursor pagination: page_after_id", async () => {
    const res = await app.request(get("/subjects?page_after_id=1"));
    const json = await res.json();
    expect(json.total_count).toBe(3); // total_count reflects all matching subjects, not just the current page
    expect(json.data[0].id).toBe(2);
    expect(json.data[1].id).toBe(3);
    expect(json.pages.previous_url).toContain("page_before_id=2");
  });

  test("pagination: next_url null when all results fit", async () => {
    const res = await app.request(get("/subjects"));
    const json = await res.json();
    expect(json.pages.next_url).toBeNull();
  });

  test("filters by updated_after", async () => {
    const res = await app.request(
      get("/subjects?updated_after=2025-06-15T00:00:00Z"),
    );
    const json = await res.json();
    expect(json.total_count).toBe(2);
    expect(json.data[0].id).toBe(2);
    expect(json.data[1].id).toBe(3);
  });

  test("updated_after returns nothing when all subjects are older", async () => {
    const res = await app.request(
      get("/subjects?updated_after=2026-01-01T00:00:00Z"),
    );
    const json = await res.json();
    expect(json.total_count).toBe(0);
  });

  test("response shape matches WaniKani format", async () => {
    const res = await app.request(get("/subjects?ids=1"));
    const json = await res.json();
    const item = json.data[0];

    expect(item.id).toBe(1);
    expect(item.object).toBe("radical");
    expect(item.url).toContain("/subjects/1");
    expect(item.data).toHaveProperty("meanings");
    expect(item.data).toHaveProperty("level");
    expect(item.data).toHaveProperty("slug");
  });
});
