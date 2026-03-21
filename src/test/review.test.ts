import { beforeEach, describe, expect, test } from "bun:test";
import type { TursoReviewService } from "../services/review.service";
import {
  createService,
  createTestDb,
  seedLevel,
  seedLevelProgression,
  seedSrsSystem,
  seedSubject,
  type TestDb,
} from "./setup";

const epoch = (iso: string) => new Date(iso).getTime();

describe("POST /reviews — correct answers", () => {
  let db: TestDb;
  let service: TursoReviewService;

  beforeEach(() => {
    db = createTestDb();
    service = createService(db);
    seedSrsSystem(db);
    seedLevel(db, 1);
    seedLevelProgression(db, 1, 1, { startedAt: Date.now() });

    // Radical at stage 3, existing review stats
    seedSubject(db, {
      id: 8,
      object: "radical",
      srsSystemId: 2,
      level: 1,
      assignmentId: 100,
      srsStage: 3,
      unlockedAt: epoch("2024-08-17T08:49:20Z"),
      startedAt: epoch("2024-08-17T09:32:58Z"),
      availableAt: epoch("2025-05-08T01:00:00Z"),
      reviewStatisticId: 500,
      meaningCorrect: 6,
      meaningIncorrect: 3,
      meaningMaxStreak: 4,
      meaningCurrentStreak: 1,
      readingCorrect: 6,
      readingIncorrect: 0,
      readingMaxStreak: 6,
      readingCurrentStreak: 6,
      percentageCorrect: 80,
    });
  });

  test("advances SRS stage 3→4, increments streaks", async () => {
    const r = await service.updateReviewStatistics({
      subject_id: 8,
      incorrect_meaning_answers: 0,
      incorrect_reading_answers: 0,
      created_at: new Date("2025-05-08T16:00:19.368Z"),
    });

    expect(r.startingSrsStage).toBe(3);
    expect(r.endingSrsStage).toBe(4);

    const s = r.subject!;
    expect(s.srsStage).toBe(4);
    expect(s.meaningCorrect).toBe(7);
    expect(s.meaningIncorrect).toBe(3);
    expect(s.meaningCurrentStreak).toBe(2);
    expect(s.meaningMaxStreak).toBe(4);
    expect(s.readingCorrect).toBe(7);
    expect(s.readingIncorrect).toBe(0);
    expect(s.readingCurrentStreak).toBe(7);
    expect(s.readingMaxStreak).toBe(7);
    expect(s.percentageCorrect).toBe(82);

    // stage 4 interval = 82800s → 2025-05-08T16:00:19 + 82800s = 2025-05-09T15:00:19 → floor → 15:00
    expect(s.availableAt).toBe(epoch("2025-05-09T15:00:00Z"));
  });

  test("resolves subject via assignment_id", async () => {
    const r = await service.updateReviewStatistics({
      assignment_id: 100,
      incorrect_meaning_answers: 0,
      incorrect_reading_answers: 0,
      created_at: new Date("2025-05-08T16:00:19Z"),
    });
    expect(r.subject!.id).toBe(8);
    expect(r.endingSrsStage).toBe(4);
  });
});

describe("POST /reviews — incorrect answers", () => {
  let db: TestDb;
  let service: TursoReviewService;

  beforeEach(() => {
    db = createTestDb();
    service = createService(db);
    seedSrsSystem(db);
    seedLevel(db, 1);
    seedLevelProgression(db, 1, 1, { startedAt: Date.now() });

    // Kanji at stage 2
    seedSubject(db, {
      id: 441,
      object: "kanji",
      srsSystemId: 2,
      level: 1,
      assignmentId: 200,
      srsStage: 2,
      unlockedAt: epoch("2024-09-18T11:54:58Z"),
      startedAt: epoch("2025-05-07T15:59:33Z"),
      availableAt: epoch("2025-05-07T21:00:00Z"),
      reviewStatisticId: 501,
      meaningCorrect: 1,
      meaningIncorrect: 0,
      meaningMaxStreak: 1,
      meaningCurrentStreak: 1,
      readingCorrect: 1,
      readingIncorrect: 0,
      readingMaxStreak: 1,
      readingCurrentStreak: 1,
      percentageCorrect: 100,
    });
  });

  test("drops SRS stage 2→1 on 1 reading error", async () => {
    const r = await service.updateReviewStatistics({
      subject_id: 441,
      incorrect_meaning_answers: 0,
      incorrect_reading_answers: 1,
      created_at: new Date("2025-05-10T04:33:09Z"),
    });

    expect(r.startingSrsStage).toBe(2);
    expect(r.endingSrsStage).toBe(1);

    const s = r.subject!;
    expect(s.meaningCorrect).toBe(2);
    expect(s.meaningCurrentStreak).toBe(2);
    expect(s.readingCorrect).toBe(2); // always increments
    expect(s.readingIncorrect).toBe(1);
    expect(s.readingCurrentStreak).toBe(1); // reset
    expect(s.percentageCorrect).toBe(80);

    // stage 1 interval = 7200s → floor → 06:00
    expect(s.availableAt).toBe(epoch("2025-05-10T06:00:00Z"));
  });

  test("multiple errors: ceil(incorrect/2) penalty", async () => {
    // Stage 2, 3 total incorrect → ceil(3/2)=2 → new stage = max(2-2*1, 1) = 1
    const r = await service.updateReviewStatistics({
      subject_id: 441,
      incorrect_meaning_answers: 2,
      incorrect_reading_answers: 1,
      created_at: new Date("2025-05-10T04:33:09Z"),
    });
    expect(r.endingSrsStage).toBe(1);
  });
});

describe("POST /reviews — SRS stage boundaries", () => {
  let db: TestDb;
  let service: TursoReviewService;

  beforeEach(() => {
    db = createTestDb();
    service = createService(db);
    seedSrsSystem(db);
    seedLevel(db, 1);
    seedLevelProgression(db, 1, 1, { startedAt: Date.now() });
  });

  test("stage caps at 9 (burn)", async () => {
    seedSubject(db, {
      id: 10,
      object: "radical",
      srsSystemId: 2,
      level: 1,
      assignmentId: 300,
      srsStage: 8,
      unlockedAt: epoch("2024-01-01T00:00:00Z"),
      startedAt: epoch("2024-01-01T00:00:00Z"),
      reviewStatisticId: 600,
    });

    const r = await service.updateReviewStatistics({
      subject_id: 10,
      incorrect_meaning_answers: 0,
      incorrect_reading_answers: 0,
      created_at: new Date("2025-06-01T12:00:00Z"),
    });

    expect(r.endingSrsStage).toBe(9);
    const s = r.subject!;
    expect(s.burnedAt).toBe(epoch("2025-06-01T12:00:00Z"));
    expect(s.availableAt).toBeNull(); // stage 9 has null interval
  });

  test("stage floors at 1 (never goes to 0)", async () => {
    seedSubject(db, {
      id: 11,
      object: "kanji",
      srsSystemId: 2,
      level: 1,
      assignmentId: 301,
      srsStage: 1,
      unlockedAt: epoch("2024-01-01T00:00:00Z"),
      startedAt: epoch("2024-01-01T00:00:00Z"),
      reviewStatisticId: 601,
    });

    const r = await service.updateReviewStatistics({
      subject_id: 11,
      incorrect_meaning_answers: 5,
      incorrect_reading_answers: 5,
      created_at: new Date("2025-06-01T12:00:00Z"),
    });

    expect(r.endingSrsStage).toBe(1);
  });

  test("sets passed_at when reaching stage 5 (Guru)", async () => {
    seedSubject(db, {
      id: 12,
      object: "kanji",
      srsSystemId: 2,
      level: 1,
      assignmentId: 302,
      srsStage: 4,
      unlockedAt: epoch("2024-01-01T00:00:00Z"),
      startedAt: epoch("2024-01-01T00:00:00Z"),
      reviewStatisticId: 602,
    });

    const r = await service.updateReviewStatistics({
      subject_id: 12,
      incorrect_meaning_answers: 0,
      incorrect_reading_answers: 0,
      created_at: new Date("2025-06-01T12:00:00Z"),
    });

    expect(r.endingSrsStage).toBe(5);
    expect(r.subject!.passedAt).toBe(epoch("2025-06-01T12:00:00Z"));
  });

  test("Guru+ penalty factor is 2x (stage >= 5)", async () => {
    seedSubject(db, {
      id: 13,
      object: "kanji",
      srsSystemId: 2,
      level: 1,
      assignmentId: 303,
      srsStage: 6,
      unlockedAt: epoch("2024-01-01T00:00:00Z"),
      startedAt: epoch("2024-01-01T00:00:00Z"),
      reviewStatisticId: 603,
    });

    // 1 incorrect → ceil(1/2)=1, penalty_factor=2 → 6 - 1*2 = 4
    const r = await service.updateReviewStatistics({
      subject_id: 13,
      incorrect_meaning_answers: 1,
      incorrect_reading_answers: 0,
      created_at: new Date("2025-06-01T12:00:00Z"),
    });

    expect(r.endingSrsStage).toBe(4);
  });

  test("Guru+ with many errors still floors at 1", async () => {
    seedSubject(db, {
      id: 14,
      object: "kanji",
      srsSystemId: 2,
      level: 1,
      assignmentId: 304,
      srsStage: 7,
      unlockedAt: epoch("2024-01-01T00:00:00Z"),
      startedAt: epoch("2024-01-01T00:00:00Z"),
      reviewStatisticId: 604,
    });

    // 4 incorrect → ceil(4/2)=2, penalty=2 → 7 - 2*2 = 3
    const r = await service.updateReviewStatistics({
      subject_id: 14,
      incorrect_meaning_answers: 2,
      incorrect_reading_answers: 2,
      created_at: new Date("2025-06-01T12:00:00Z"),
    });

    expect(r.endingSrsStage).toBe(3);
  });

  test("preserves existing passedAt on subsequent reviews", async () => {
    const passedEpoch = epoch("2025-01-01T00:00:00Z");
    seedSubject(db, {
      id: 15,
      object: "kanji",
      srsSystemId: 2,
      level: 1,
      assignmentId: 305,
      srsStage: 6,
      passedAt: passedEpoch,
      unlockedAt: epoch("2024-01-01T00:00:00Z"),
      startedAt: epoch("2024-01-01T00:00:00Z"),
      reviewStatisticId: 605,
    });

    const r = await service.updateReviewStatistics({
      subject_id: 15,
      incorrect_meaning_answers: 0,
      incorrect_reading_answers: 0,
      created_at: new Date("2025-06-01T12:00:00Z"),
    });

    // passedAt should NOT be overwritten
    expect(r.subject!.passedAt).toBe(passedEpoch);
  });
});

describe("POST /reviews — error handling", () => {
  let db: TestDb;
  let service: TursoReviewService;

  beforeEach(() => {
    db = createTestDb();
    service = createService(db);
    seedSrsSystem(db);
    seedLevel(db, 1);
  });

  test("throws when no subject_id or assignment_id", async () => {
    expect(
      service.updateReviewStatistics({
        incorrect_meaning_answers: 0,
        incorrect_reading_answers: 0,
      }),
    ).rejects.toThrow("No subject_id or assignment_id");
  });

  test("throws when subject not found", async () => {
    expect(
      service.updateReviewStatistics({
        subject_id: 999,
        incorrect_meaning_answers: 0,
        incorrect_reading_answers: 0,
      }),
    ).rejects.toThrow("Subject not found");
  });

  test("throws when assignment_id not found", async () => {
    expect(
      service.updateReviewStatistics({
        assignment_id: 999,
        incorrect_meaning_answers: 0,
        incorrect_reading_answers: 0,
      }),
    ).rejects.toThrow("Assignment not found");
  });
});
