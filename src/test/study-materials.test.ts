import { beforeEach, describe, expect, test } from "bun:test";
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

const _epoch = (iso: string) => new Date(iso).getTime();

function get(path: string) {
  return new Request(`http://localhost/v2${path}`);
}

describe("GET /study_materials", () => {
  let db: TestDb;
  let app: Hono<AuthEnv>;

  beforeEach(() => {
    db = createTestDb();
    app = createTestApp(db);
    seedSrsSystem(db);
    seedLevel(db, 1);

    // Subject with study material
    seedSubject(db, {
      id: 1,
      object: "radical",
      srsSystemId: 2,
      level: 1,
      assignmentId: 100,
      srsStage: 3,
      studyMaterialId: 50,
      meaningNote: "test note",
      meaningSynonyms: JSON.stringify(["syn1"]),
    });
    // Subject without study material
    seedSubject(db, {
      id: 2,
      object: "kanji",
      srsSystemId: 2,
      level: 1,
      assignmentId: 200,
      srsStage: 2,
    });
  });

  test("returns only subjects with study materials", async () => {
    const res = await app.request(get("/study_materials"));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.total_count).toBe(1);
    expect(json.data[0].id).toBe(50);
  });

  test("filters by ids", async () => {
    const res = await app.request(get("/study_materials?ids=50"));
    const json = await res.json();
    expect(json.total_count).toBe(1);
  });

  test("filters by subject_ids", async () => {
    const res = await app.request(get("/study_materials?subject_ids=1"));
    const json = await res.json();
    expect(json.total_count).toBe(1);
  });

  test("filters by subject_types", async () => {
    const res = await app.request(
      get("/study_materials?subject_types=radical"),
    );
    const json = await res.json();
    expect(json.total_count).toBe(1);
  });

  test("returns empty for non-matching filter", async () => {
    const res = await app.request(get("/study_materials?subject_types=kanji"));
    const json = await res.json();
    expect(json.total_count).toBe(0);
  });
});

describe("POST /study_materials", () => {
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
      srsStage: 3,
    });
  });

  test("creates study material with auto-increment ID", async () => {
    const res = await app.request(
      new Request("http://localhost/v2/study_materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject_id: 1,
          meaning_note: "my note",
          reading_note: "read note",
          meaning_synonyms: ["alt1", "alt2"],
        }),
      }),
    );

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.id).toBeGreaterThan(0);
    expect(json.data.meaning_note).toBe("my note");
    expect(json.data.reading_note).toBe("read note");
    expect(json.data.meaning_synonyms).toEqual(["alt1", "alt2"]);
    expect(json.data.subject_id).toBe(1);
  });

  test("returns 404 for nonexistent subject", async () => {
    const res = await app.request(
      new Request("http://localhost/v2/study_materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject_id: 999 }),
      }),
    );
    expect(res.status).toBe(404);
  });
});

describe("PUT /study_materials/:id", () => {
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
      srsStage: 3,
      studyMaterialId: 50,
      meaningNote: "old note",
      readingNote: "old reading",
      meaningSynonyms: JSON.stringify(["old"]),
    });
  });

  test("partial update: meaning_note only", async () => {
    const res = await app.request(
      new Request("http://localhost/v2/study_materials/50", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meaning_note: "new note" }),
      }),
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.meaning_note).toBe("new note");
    expect(json.data.reading_note).toBe("old reading"); // unchanged
  });

  test("partial update: meaning_synonyms", async () => {
    const res = await app.request(
      new Request("http://localhost/v2/study_materials/50", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meaning_synonyms: ["new1", "new2"] }),
      }),
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.meaning_synonyms).toEqual(["new1", "new2"]);
  });

  test("returns 404 for nonexistent study material", async () => {
    const res = await app.request(
      new Request("http://localhost/v2/study_materials/999", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meaning_note: "test" }),
      }),
    );
    expect(res.status).toBe(404);
  });
});
