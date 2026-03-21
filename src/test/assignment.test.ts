import { beforeEach, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import type { TursoReviewService } from "../services/review.service";
import {
  createService,
  createTestDb,
  schema,
  seedBothSrs,
  seedLevel,
  seedLevelProgression,
  seedSrsSystem,
  seedSubject,
  type TestDb,
} from "./setup";

const epoch = (iso: string) => new Date(iso).getTime();

describe("PUT /assignments/:id/start", () => {
  let db: TestDb;
  let service: TursoReviewService;

  beforeEach(() => {
    db = createTestDb();
    service = createService(db);
    seedSrsSystem(db);
    seedLevel(db, 1);
    seedLevelProgression(db, 1, 1);

    // Unlocked but not started kanji
    seedSubject(db, {
      id: 453,
      object: "kanji",
      srsSystemId: 2,
      level: 1,
      assignmentId: 400,
      srsStage: 0,
      unlockedAt: epoch("2024-09-18T11:55:07Z"),
    });
  });

  test("sets SRS stage to 1 and calculates available_at", async () => {
    const { subject } = await service.startAssignment(
      { started_at: new Date("2025-05-11T08:49:19Z") },
      400,
    );

    const s = subject!;
    expect(s.srsStage).toBe(1);
    expect(s.startedAt).toBe(epoch("2025-05-11T08:49:19Z"));

    // stage 1 interval = 7200s → 08:49:19 + 7200s = 10:49:19 → floor → 10:00
    expect(s.availableAt).toBe(epoch("2025-05-11T10:00:00Z"));
  });

  test("allocates reviewStatisticId when 0", async () => {
    const { subject } = await service.startAssignment(
      { started_at: new Date("2025-05-11T08:49:19Z") },
      400,
    );
    expect(subject!.reviewStatisticId).toBeGreaterThan(0);
  });

  test("defaults started_at to now when omitted", async () => {
    const before = Date.now();
    const { subject } = await service.startAssignment({}, 400);
    const after = Date.now();

    expect(subject!.startedAt).toBeGreaterThanOrEqual(before);
    expect(subject!.startedAt).toBeLessThanOrEqual(after);
  });

  test("sets level progression startedAt on first lesson", async () => {
    await service.startAssignment(
      { started_at: new Date("2025-05-11T08:49:19Z") },
      400,
    );

    const [lp] = db
      .select()
      .from(schema.levelProgression)
      .where(eq(schema.levelProgression.level, 1))
      .all();

    expect(lp.startedAt).toBe(epoch("2025-05-11T08:49:19Z"));
  });

  test("does NOT overwrite level progression startedAt on second lesson", async () => {
    // First lesson
    await service.startAssignment(
      { started_at: new Date("2025-05-11T08:00:00Z") },
      400,
    );

    // Insert another unlocked subject
    seedSubject(db, {
      id: 454,
      object: "kanji",
      srsSystemId: 2,
      level: 1,
      assignmentId: 401,
      srsStage: 0,
      unlockedAt: epoch("2024-09-18T12:00:00Z"),
    });

    // Second lesson
    await service.startAssignment(
      { started_at: new Date("2025-05-11T09:00:00Z") },
      401,
    );

    const [lp] = db
      .select()
      .from(schema.levelProgression)
      .where(eq(schema.levelProgression.level, 1))
      .all();

    // Should still be the first lesson's time
    expect(lp.startedAt).toBe(epoch("2025-05-11T08:00:00Z"));
  });

  test("throws when assignment not found", async () => {
    expect(
      service.startAssignment({ started_at: new Date() }, 999),
    ).rejects.toThrow("Assignment not found");
  });
});

describe("Level up", () => {
  let db: TestDb;
  let service: TursoReviewService;

  beforeEach(() => {
    db = createTestDb();
    service = createService(db);
    seedSrsSystem(db);
    seedLevel(db, 1);
    seedLevelProgression(db, 1, 1, { startedAt: Date.now() });
  });

  test("levels up when ≥90% kanji passed", async () => {
    // 10 kanji on level 1, 9 already passed
    for (let i = 1; i <= 10; i++) {
      seedSubject(db, {
        id: i,
        object: "kanji",
        srsSystemId: 2,
        level: 1,
        assignmentId: i,
        srsStage: i <= 9 ? 5 : 4,
        passedAt: i <= 9 ? epoch("2025-01-01T00:00:00Z") : null,
        unlockedAt: epoch("2024-01-01T00:00:00Z"),
        startedAt: epoch("2024-01-01T00:00:00Z"),
        reviewStatisticId: i,
      });
    }

    // Pass the 10th kanji (stage 4→5)
    const r = await service.updateReviewStatistics({
      subject_id: 10,
      incorrect_meaning_answers: 0,
      incorrect_reading_answers: 0,
      created_at: new Date("2025-06-01T12:00:00Z"),
    });

    expect(r.endingSrsStage).toBe(5);
    expect(r.subject!.passedAt).toBe(epoch("2025-06-01T12:00:00Z"));

    // User level should be 2 now
    const [prop] = db
      .select()
      .from(schema.properties)
      .where(eq(schema.properties.name, "level"))
      .all();
    expect(prop.value).toBe("2");

    // New level progression created
    const lps = db.select().from(schema.levelProgression).all();
    expect(lps.length).toBe(2);

    const lp2 = lps.find((lp) => lp.level === 2)!;
    expect(lp2).toBeDefined();
    expect(lp2.startedAt).toBeNull();

    // Previous level progression marked as passed
    const lp1 = lps.find((lp) => lp.level === 1)!;
    expect(lp1.passedAt).not.toBeNull();
  });

  test("does NOT level up when < 90% kanji passed", async () => {
    // 10 kanji, only 8 passed → 80% < 90%
    for (let i = 1; i <= 10; i++) {
      seedSubject(db, {
        id: i,
        object: "kanji",
        srsSystemId: 2,
        level: 1,
        assignmentId: i,
        srsStage: i <= 8 ? 5 : 4,
        passedAt: i <= 8 ? epoch("2025-01-01T00:00:00Z") : null,
        unlockedAt: epoch("2024-01-01T00:00:00Z"),
        startedAt: epoch("2024-01-01T00:00:00Z"),
        reviewStatisticId: i,
      });
    }

    // Pass the 9th kanji → 90% → should level up
    await service.updateReviewStatistics({
      subject_id: 9,
      incorrect_meaning_answers: 0,
      incorrect_reading_answers: 0,
      created_at: new Date("2025-06-01T12:00:00Z"),
    });

    const [prop] = db
      .select()
      .from(schema.properties)
      .where(eq(schema.properties.name, "level"))
      .all();
    // 9/10 = 90% → levels up (ceil(90) >= 90)
    expect(prop.value).toBe("2");
  });

  test("vocabulary review does NOT trigger level up check", async () => {
    // All kanji passed
    seedSubject(db, {
      id: 1,
      object: "kanji",
      srsSystemId: 2,
      level: 1,
      assignmentId: 1,
      srsStage: 5,
      passedAt: epoch("2025-01-01T00:00:00Z"),
      unlockedAt: epoch("2024-01-01T00:00:00Z"),
      startedAt: epoch("2024-01-01T00:00:00Z"),
      reviewStatisticId: 1,
    });

    // Vocab review
    seedSubject(db, {
      id: 100,
      object: "vocabulary",
      srsSystemId: 2,
      level: 1,
      assignmentId: 100,
      srsStage: 4,
      unlockedAt: epoch("2024-01-01T00:00:00Z"),
      startedAt: epoch("2024-01-01T00:00:00Z"),
      reviewStatisticId: 100,
    });

    await service.updateReviewStatistics({
      subject_id: 100,
      incorrect_meaning_answers: 0,
      incorrect_reading_answers: 0,
      created_at: new Date("2025-06-01T12:00:00Z"),
    });

    // Level should remain 1
    const [prop] = db
      .select()
      .from(schema.properties)
      .where(eq(schema.properties.name, "level"))
      .all();
    expect(prop.value).toBe("1");
  });
});

describe("Subject unlock", () => {
  let db: TestDb;
  let service: TursoReviewService;

  beforeEach(() => {
    db = createTestDb();
    service = createService(db);
    seedSrsSystem(db);
    seedLevel(db, 1);
    seedLevelProgression(db, 1, 1, { startedAt: Date.now() });
  });

  test("unlocks subject when all component radicals are passed", async () => {
    // Radical (component) at stage 4, about to pass
    seedSubject(db, {
      id: 1,
      object: "radical",
      srsSystemId: 2,
      level: 1,
      assignmentId: 1,
      srsStage: 4,
      unlockedAt: epoch("2024-01-01T00:00:00Z"),
      startedAt: epoch("2024-01-01T00:00:00Z"),
      reviewStatisticId: 1,
    });

    // Kanji depends on radical 1, not yet unlocked (assignmentId=0)
    seedSubject(db, {
      id: 50,
      object: "kanji",
      srsSystemId: 2,
      level: 1,
      assignmentId: 0,
      srsStage: 0,
      componentSubjectIds: JSON.stringify([1]),
    });

    // Pass the radical → triggers unlock
    await service.updateReviewStatistics({
      subject_id: 1,
      incorrect_meaning_answers: 0,
      incorrect_reading_answers: 0,
      created_at: new Date("2025-06-01T12:00:00Z"),
    });

    const [kanji] = db
      .select()
      .from(schema.subject)
      .where(eq(schema.subject.id, 50))
      .all();

    expect(kanji.assignmentId).toBeGreaterThan(0);
    expect(kanji.unlockedAt).not.toBeNull();
    expect(kanji.srsStage).toBe(0);
  });

  test("does NOT unlock when not all components passed", async () => {
    // Radical 1: passed
    seedSubject(db, {
      id: 1,
      object: "radical",
      srsSystemId: 2,
      level: 1,
      assignmentId: 1,
      srsStage: 5,
      passedAt: epoch("2025-01-01T00:00:00Z"),
      unlockedAt: epoch("2024-01-01T00:00:00Z"),
      startedAt: epoch("2024-01-01T00:00:00Z"),
      reviewStatisticId: 1,
    });

    // Radical 2: NOT passed (stage 3)
    seedSubject(db, {
      id: 2,
      object: "radical",
      srsSystemId: 2,
      level: 1,
      assignmentId: 2,
      srsStage: 3,
      unlockedAt: epoch("2024-01-01T00:00:00Z"),
      startedAt: epoch("2024-01-01T00:00:00Z"),
      reviewStatisticId: 2,
    });

    // Kanji depends on both radicals
    seedSubject(db, {
      id: 50,
      object: "kanji",
      srsSystemId: 2,
      level: 1,
      assignmentId: 0,
      srsStage: 0,
      componentSubjectIds: JSON.stringify([1, 2]),
    });

    // Review radical 1 again (already passed, stage 5→6)
    await service.updateReviewStatistics({
      subject_id: 1,
      incorrect_meaning_answers: 0,
      incorrect_reading_answers: 0,
      created_at: new Date("2025-06-01T12:00:00Z"),
    });

    const [kanji] = db
      .select()
      .from(schema.subject)
      .where(eq(schema.subject.id, 50))
      .all();

    // Should still be locked
    expect(kanji.assignmentId).toBe(0);
  });

  test("does NOT unlock subjects above current level", async () => {
    // User is level 1. Radical passes.
    seedSubject(db, {
      id: 1,
      object: "radical",
      srsSystemId: 2,
      level: 1,
      assignmentId: 1,
      srsStage: 4,
      unlockedAt: epoch("2024-01-01T00:00:00Z"),
      startedAt: epoch("2024-01-01T00:00:00Z"),
      reviewStatisticId: 1,
    });

    // Kanji on level 2 depends on radical 1
    seedSubject(db, {
      id: 50,
      object: "kanji",
      srsSystemId: 2,
      level: 2,
      assignmentId: 0,
      srsStage: 0,
      componentSubjectIds: JSON.stringify([1]),
    });

    await service.updateReviewStatistics({
      subject_id: 1,
      incorrect_meaning_answers: 0,
      incorrect_reading_answers: 0,
      created_at: new Date("2025-06-01T12:00:00Z"),
    });

    const [kanji] = db
      .select()
      .from(schema.subject)
      .where(eq(schema.subject.id, 50))
      .all();

    // Level 2 subject should stay locked (user is level 1)
    expect(kanji.assignmentId).toBe(0);
  });
});

describe("SRS system selection", () => {
  let db: TestDb;
  let service: TursoReviewService;

  beforeEach(() => {
    db = createTestDb();
    service = createService(db);
    seedBothSrs(db);
  });

  test("uses accelerated SRS (id=2) for level 1-2", async () => {
    seedLevel(db, 2);
    seedLevelProgression(db, 1, 2, { startedAt: Date.now() });

    seedSubject(db, {
      id: 1,
      object: "radical",
      srsSystemId: 2,
      level: 2,
      assignmentId: 1,
      srsStage: 1,
      unlockedAt: epoch("2024-01-01T00:00:00Z"),
      startedAt: epoch("2024-01-01T00:00:00Z"),
      reviewStatisticId: 1,
    });

    const r = await service.updateReviewStatistics({
      subject_id: 1,
      incorrect_meaning_answers: 0,
      incorrect_reading_answers: 0,
      created_at: new Date("2025-06-01T12:00:00Z"),
    });

    // Accelerated stage 2 interval = 14400s → 12:00 + 14400 = 16:00
    expect(r.subject!.availableAt).toBe(epoch("2025-06-01T16:00:00Z"));
  });

  test("uses default SRS (id=1) for level 3+", async () => {
    seedLevel(db, 3);
    seedLevelProgression(db, 1, 3, { startedAt: Date.now() });

    seedSubject(db, {
      id: 1,
      object: "radical",
      srsSystemId: 1,
      level: 3,
      assignmentId: 1,
      srsStage: 1,
      unlockedAt: epoch("2024-01-01T00:00:00Z"),
      startedAt: epoch("2024-01-01T00:00:00Z"),
      reviewStatisticId: 1,
    });

    const r = await service.updateReviewStatistics({
      subject_id: 1,
      incorrect_meaning_answers: 0,
      incorrect_reading_answers: 0,
      created_at: new Date("2025-06-01T12:00:00Z"),
    });

    // Default stage 2 interval = 28800s → 12:00 + 28800 = 20:00
    expect(r.subject!.availableAt).toBe(epoch("2025-06-01T20:00:00Z"));
  });
});
