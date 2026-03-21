import { beforeEach, describe, expect, test } from "bun:test";
import type { Hono } from "hono";
import type { AuthEnv } from "../../middleware/auth";
import {
  createTestApp,
  createTestDb,
  seedProperty,
  type TestDb,
} from "../setup";

describe("GET /user", () => {
  let db: TestDb;
  let app: Hono<AuthEnv>;

  beforeEach(() => {
    db = createTestDb();
    app = createTestApp(db);
  });

  test("returns user with properties", async () => {
    seedProperty(db, "user_id", "abc-123");
    seedProperty(db, "username", "testuser");
    seedProperty(db, "level", "5");
    seedProperty(db, "profile_url", "https://example.com/user");
    seedProperty(db, "started_at", "2024-01-15T10:00:00Z");

    const res = await app.request(new Request("http://localhost/v2/user"));
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.object).toBe("user");
    expect(json.url).toBe("http://localhost/v2/user");
    expect(json.data.id).toBe("abc-123");
    expect(json.data.username).toBe("testuser");
    expect(json.data.level).toBe(5);
    expect(json.data.subscription.active).toBe(true);
    expect(json.data.subscription.type).toBe("lifetime");
    expect(json.data.subscription.max_level_granted).toBe(60);
    expect(json.data.preferences.lessons_batch_size).toBe(5);
  });

  test("returns defaults when properties missing", async () => {
    const res = await app.request(new Request("http://localhost/v2/user"));
    const json = await res.json();

    expect(json.data.id).toBe("");
    expect(json.data.username).toBe("");
    expect(json.data.level).toBe(1);
    expect(json.data.started_at).toBeNull();
  });
});
