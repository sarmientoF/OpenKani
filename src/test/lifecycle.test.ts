import { beforeEach, describe, expect, test } from "bun:test";
import { roundToNearestHours } from "date-fns";
import { eq } from "drizzle-orm";
import type { TursoReviewService } from "../services/review.service";
import {
  createService,
  createTestDb,
  schema,
  seedLevel,
  seedLevelProgression,
  seedSrsSystem,
  seedSubject,
  type TestDb,
} from "./setup";

const epoch = (iso: string) => new Date(iso).getTime();

/** Accelerated SRS intervals in seconds */
const INTERVALS = [
  null,
  7200,
  14400,
  28800,
  82800,
  601200,
  1206000,
  2588400,
  10364400,
  null,
];

function expectedAvailableAt(
  reviewTimeIso: string,
  intervalSec: number,
): number {
  const t = new Date(reviewTimeIso);
  const next = new Date(t.getTime() + intervalSec * 1000);
  return roundToNearestHours(next, { roundingMethod: "floor" }).getTime();
}

describe("Full SRS lifecycle: stage 1→9 burn", () => {
  let db: TestDb;
  let service: TursoReviewService;

  beforeEach(() => {
    db = createTestDb();
    service = createService(db);
    seedSrsSystem(db);
    seedLevel(db, 1);
    seedLevelProgression(db, 1, 1, { startedAt: Date.now() });

    seedSubject(db, {
      id: 1,
      object: "radical",
      srsSystemId: 2,
      level: 1,
      assignmentId: 100,
      srsStage: 0,
      unlockedAt: epoch("2025-01-01T00:00:00Z"),
    });
  });

  test("progresses through all stages with correct intervals", async () => {
    // Start assignment (lesson)
    const T0 = "2025-01-01T10:30:00Z";
    const { subject: s0 } = await service.startAssignment(
      { started_at: new Date(T0) },
      100,
    );
    expect(s0!.srsStage).toBe(1);
    const expectedAt1 = expectedAvailableAt(T0, INTERVALS[1]!);
    expect(s0!.availableAt).toBe(expectedAt1);

    // Review through stages 1→8, each time reviewing 1h after available
    const reviewTimes = [
      "2025-01-01T13:00:00Z", // stage 1→2 (available ~12:30 → review at 13:00)
      "2025-01-01T17:30:00Z", // stage 2→3
      "2025-01-02T02:00:00Z", // stage 3→4
      "2025-01-02T22:00:00Z", // stage 4→5 (Guru)
      "2025-01-10T01:00:00Z", // stage 5→6
      "2025-01-24T06:00:00Z", // stage 6→7
      "2025-02-23T12:00:00Z", // stage 7→8
      "2025-06-22T18:00:00Z", // stage 8→9 (Burn)
    ];

    for (let i = 0; i < reviewTimes.length; i++) {
      const expectedStage = i + 2;
      const r = await service.updateReviewStatistics({
        subject_id: 1,
        incorrect_meaning_answers: 0,
        incorrect_reading_answers: 0,
        created_at: new Date(reviewTimes[i]),
      });

      expect(r.startingSrsStage).toBe(expectedStage - 1);
      expect(r.endingSrsStage).toBe(expectedStage);

      if (expectedStage < 9) {
        const expectedAt = expectedAvailableAt(
          reviewTimes[i],
          INTERVALS[expectedStage]!,
        );
        expect(r.subject!.availableAt).toBe(expectedAt);
      } else {
        // Burned: no more reviews
        expect(r.subject!.availableAt).toBeNull();
        expect(r.subject!.burnedAt).toBe(epoch(reviewTimes[i]));
      }

      // passedAt set at stage 5
      if (expectedStage >= 5) {
        expect(r.subject!.passedAt).not.toBeNull();
      }
    }
  });
});

describe("Full unlock chain + level up", () => {
  let db: TestDb;
  let service: TursoReviewService;

  beforeEach(() => {
    db = createTestDb();
    service = createService(db);
    seedSrsSystem(db);
    seedLevel(db, 1);
    seedLevelProgression(db, 1, 1);

    // 10 radicals (unlocked, not started)
    for (let i = 1; i <= 10; i++) {
      seedSubject(db, {
        id: i,
        object: "radical",
        srsSystemId: 2,
        level: 1,
        assignmentId: i,
        srsStage: 0,
        unlockedAt: epoch("2025-01-01T00:00:00Z"),
      });
    }

    // 10 kanji (locked, each depends on one radical)
    for (let i = 1; i <= 10; i++) {
      seedSubject(db, {
        id: 100 + i,
        object: "kanji",
        srsSystemId: 2,
        level: 1,
        assignmentId: 0,
        srsStage: 0,
        componentSubjectIds: JSON.stringify([i]),
      });
    }

    // 2 vocab (locked, depend on kanji 101, 102)
    seedSubject(db, {
      id: 201,
      object: "vocabulary",
      srsSystemId: 2,
      level: 1,
      assignmentId: 0,
      srsStage: 0,
      componentSubjectIds: JSON.stringify([101]),
    });
    seedSubject(db, {
      id: 202,
      object: "vocabulary",
      srsSystemId: 2,
      level: 1,
      assignmentId: 0,
      srsStage: 0,
      componentSubjectIds: JSON.stringify([102]),
    });
  });

  test("radical→kanji unlock→level up→vocab unlock", async () => {
    const T = "2025-01-01T10:00:00Z";

    // Start all 10 radicals
    for (let i = 1; i <= 10; i++) {
      await service.startAssignment({ started_at: new Date(T) }, i);
    }

    // Review each radical through stages 1→5 (Guru)
    const reviewTimes = [
      "2025-01-01T13:00:00Z",
      "2025-01-01T18:00:00Z",
      "2025-01-02T03:00:00Z",
      "2025-01-03T06:00:00Z",
    ];
    for (const time of reviewTimes) {
      for (let i = 1; i <= 10; i++) {
        await service.updateReviewStatistics({
          subject_id: i,
          incorrect_meaning_answers: 0,
          incorrect_reading_answers: 0,
          created_at: new Date(time),
        });
      }
    }

    // Verify all radicals at stage 5 (Guru) and all kanji unlocked
    for (let i = 1; i <= 10; i++) {
      const [rad] = db
        .select()
        .from(schema.subject)
        .where(eq(schema.subject.id, i))
        .all();
      expect(rad.srsStage).toBe(5);
      expect(rad.passedAt).not.toBeNull();

      const [kan] = db
        .select()
        .from(schema.subject)
        .where(eq(schema.subject.id, 100 + i))
        .all();
      expect(kan.assignmentId).toBeGreaterThan(0);
      expect(kan.unlockedAt).not.toBeNull();
    }

    // Start all 10 kanji
    for (let i = 1; i <= 10; i++) {
      const [k] = db
        .select()
        .from(schema.subject)
        .where(eq(schema.subject.id, 100 + i))
        .all();
      await service.startAssignment(
        { started_at: new Date("2025-01-10T10:00:00Z") },
        k.assignmentId,
      );
    }

    // Review 9/10 kanji through stages 1→5 (Guru)
    const kanjiReviewTimes = [
      "2025-01-10T13:00:00Z",
      "2025-01-10T18:00:00Z",
      "2025-01-11T03:00:00Z",
      "2025-01-12T06:00:00Z",
    ];
    for (const time of kanjiReviewTimes) {
      for (let i = 1; i <= 9; i++) {
        await service.updateReviewStatistics({
          subject_id: 100 + i,
          incorrect_meaning_answers: 0,
          incorrect_reading_answers: 0,
          created_at: new Date(time),
        });
      }
    }

    // Verify level up: 9/10 kanji passed = 90%
    const [levelProp] = db
      .select()
      .from(schema.properties)
      .where(eq(schema.properties.name, "level"))
      .all();
    expect(levelProp.value).toBe("2");

    // Verify level progression
    const lps = db.select().from(schema.levelProgression).all();
    expect(lps.length).toBe(2);
    const lp1 = lps.find((lp) => lp.level === 1)!;
    expect(lp1.passedAt).not.toBeNull();
    const lp2 = lps.find((lp) => lp.level === 2)!;
    expect(lp2).toBeDefined();

    // Verify vocab 201 and 202 unlocked (kanji 101, 102 passed Guru)
    const [v1] = db
      .select()
      .from(schema.subject)
      .where(eq(schema.subject.id, 201))
      .all();
    expect(v1.assignmentId).toBeGreaterThan(0);
    expect(v1.unlockedAt).not.toBeNull();

    const [v2] = db
      .select()
      .from(schema.subject)
      .where(eq(schema.subject.id, 202))
      .all();
    expect(v2.assignmentId).toBeGreaterThan(0);
    expect(v2.unlockedAt).not.toBeNull();
  });
});
