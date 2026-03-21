import {
  afterEach,
  beforeEach,
  describe,
  expect,
  setSystemTime,
  test,
} from "bun:test";
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
const NOW = new Date("2025-06-15T14:30:00Z");

function get(path: string) {
  return new Request(`http://localhost/v2${path}`);
}

describe("GET /assignments", () => {
  let db: TestDb;
  let app: Hono<AuthEnv>;

  beforeEach(() => {
    setSystemTime(NOW);
    db = createTestDb();
    app = createTestApp(db);
    seedSrsSystem(db);
    seedLevel(db, 1);
    seedLevelProgression(db, 1, 1, { startedAt: Date.now() });

    // Radical: started, stage 3, level 1
    seedSubject(db, {
      id: 1,
      object: "radical",
      srsSystemId: 2,
      level: 1,
      assignmentId: 100,
      srsStage: 3,
      unlockedAt: epoch("2025-01-01T00:00:00Z"),
      startedAt: epoch("2025-01-01T01:00:00Z"),
      availableAt: epoch("2025-06-15T10:00:00Z"),
    });
    // Kanji: started, stage 5, level 2, burned
    seedSubject(db, {
      id: 2,
      object: "kanji",
      srsSystemId: 2,
      level: 2,
      assignmentId: 200,
      srsStage: 9,
      unlockedAt: epoch("2025-01-01T00:00:00Z"),
      startedAt: epoch("2025-01-01T01:00:00Z"),
      burnedAt: epoch("2025-06-01T00:00:00Z"),
    });
    // Vocab: not started (lesson available)
    seedSubject(db, {
      id: 3,
      object: "vocabulary",
      srsSystemId: 2,
      level: 1,
      assignmentId: 300,
      srsStage: 0,
      unlockedAt: epoch("2025-01-01T00:00:00Z"),
    });
    // Locked subject (no assignment)
    seedSubject(db, {
      id: 4,
      object: "kanji",
      srsSystemId: 2,
      level: 1,
      assignmentId: 0,
      srsStage: 0,
    });
  });

  afterEach(() => {
    setSystemTime();
  });

  test("returns all assigned subjects", async () => {
    const res = await app.request(get("/assignments"));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.object).toBe("collection");
    expect(json.total_count).toBe(3); // excludes id=4 (assignmentId=0)
  });

  test("filters by ids (assignmentId)", async () => {
    const res = await app.request(get("/assignments?ids=100"));
    const json = await res.json();
    expect(json.total_count).toBe(1);
    expect(json.data[0].id).toBe(100);
  });

  test("filters by levels", async () => {
    const res = await app.request(get("/assignments?levels=2"));
    const json = await res.json();
    expect(json.total_count).toBe(1);
    expect(json.data[0].data.subject_id).toBe(2);
  });

  test("filters by srs_stages", async () => {
    const res = await app.request(get("/assignments?srs_stages=3"));
    const json = await res.json();
    expect(json.total_count).toBe(1);
    expect(json.data[0].data.srs_stage).toBe(3);
  });

  test("filters by subject_types", async () => {
    const res = await app.request(get("/assignments?subject_types=vocabulary"));
    const json = await res.json();
    expect(json.total_count).toBe(1);
    expect(json.data[0].data.subject_type).toBe("vocabulary");
  });

  test("filters burned=true", async () => {
    const res = await app.request(get("/assignments?burned=true"));
    const json = await res.json();
    expect(json.total_count).toBe(1);
    expect(json.data[0].data.burned_at).not.toBeNull();
  });

  test("filters burned=false", async () => {
    const res = await app.request(get("/assignments?burned=false"));
    const json = await res.json();
    expect(json.total_count).toBe(2);
  });

  test("filters started=true", async () => {
    const res = await app.request(get("/assignments?started=true"));
    const json = await res.json();
    expect(json.total_count).toBe(2); // id=1 and id=2
  });

  test("filters started=false", async () => {
    const res = await app.request(get("/assignments?started=false"));
    const json = await res.json();
    expect(json.total_count).toBe(1); // id=3
  });

  test("filters immediately_available_for_lessons", async () => {
    const res = await app.request(
      get("/assignments?immediately_available_for_lessons=true"),
    );
    const json = await res.json();
    expect(json.total_count).toBe(1);
    expect(json.data[0].data.subject_id).toBe(3);
  });

  test("filters immediately_available_for_review", async () => {
    const res = await app.request(
      get("/assignments?immediately_available_for_review=true"),
    );
    const json = await res.json();
    // id=1 has availableAt in the past (10:00), now is 14:30
    expect(json.total_count).toBe(1);
    expect(json.data[0].data.subject_id).toBe(1);
  });

  test("filters by comma-separated levels", async () => {
    const res = await app.request(get("/assignments?levels=1,2"));
    const json = await res.json();
    expect(json.total_count).toBe(3);
  });

  test("response shape matches WaniKani format", async () => {
    const res = await app.request(get("/assignments?ids=100"));
    const json = await res.json();
    const item = json.data[0];

    expect(item.object).toBe("assignment");
    expect(item.url).toContain("/assignments/100");
    expect(item.data).toHaveProperty("subject_id");
    expect(item.data).toHaveProperty("subject_type");
    expect(item.data).toHaveProperty("srs_stage");
    expect(item.data).toHaveProperty("available_at");
    expect(item.data).toHaveProperty("started_at");
  });
});

describe("PUT /assignments/:id/start", () => {
  let db: TestDb;
  let app: Hono<AuthEnv>;

  beforeEach(() => {
    db = createTestDb();
    app = createTestApp(db);
    seedSrsSystem(db);
    seedLevel(db, 1);
    seedLevelProgression(db, 1, 1);

    seedSubject(db, {
      id: 1,
      object: "kanji",
      srsSystemId: 2,
      level: 1,
      assignmentId: 500,
      srsStage: 0,
      unlockedAt: epoch("2025-01-01T00:00:00Z"),
    });
  });

  test("starts assignment and returns response", async () => {
    const res = await app.request(
      new Request("http://localhost/v2/assignments/500/start", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ started_at: "2025-06-15T10:00:00Z" }),
      }),
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.srs_stage).toBe(1);
    expect(json.data.started_at).not.toBeNull();
  });

  test("returns error for nonexistent assignment", async () => {
    const res = await app.request(
      new Request("http://localhost/v2/assignments/999/start", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(500); // throws "Assignment not found"
  });
});
