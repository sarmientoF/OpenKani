import { add, roundToNearestHours } from "date-fns";
import { and, eq, isNotNull, lte, sql } from "drizzle-orm";
import * as schema from "../db/schema";
import type { UserDb } from "./turso.service";

const logger = {
  info: (...args: unknown[]) => console.log("[review-service]", ...args),
};

interface ReviewCreateParams {
  assignment_id?: number;
  subject_id?: number;
  incorrect_meaning_answers?: number;
  incorrect_reading_answers?: number;
  created_at?: Date;
}

interface AssignmentStartParams {
  started_at?: Date;
}

interface Stage {
  interval: number | null;
  interval_unit: string;
  position: number;
}

export class TursoReviewService {
  constructor(private readonly db: UserDb) {}

  async updateReviewStatistics(review: ReviewCreateParams) {
    review.created_at ??= new Date();
    const createdAtEpoch = review.created_at.getTime();

    const level = await this.getUserLevel();

    let subjectId = review.subject_id;
    if (!subjectId && review.assignment_id) {
      const [row] = await this.db
        .select({ id: schema.subject.id })
        .from(schema.subject)
        .where(eq(schema.subject.assignmentId, review.assignment_id))
        .limit(1);
      if (!row) throw new Error("Assignment not found");
      subjectId = row.id;
    }
    if (!subjectId) throw new Error("No subject_id or assignment_id");

    const [subject] = await this.db
      .select()
      .from(schema.subject)
      .where(eq(schema.subject.id, subjectId))
      .limit(1);
    if (!subject) throw new Error("Subject not found");

    const stages = await this.getSrsStages(level);
    const startingSrsStage = subject.srsStage;

    const incorrectMeaning = review.incorrect_meaning_answers ?? 0;
    const incorrectReading = review.incorrect_reading_answers ?? 0;
    const incorrectAnswers = incorrectMeaning + incorrectReading;
    const newSrsStage = this.getNewSrsStage(subject.srsStage, incorrectAnswers);

    const burnedAt =
      subject.burnedAt || (newSrsStage >= 9 ? createdAtEpoch : null);
    const passedAt =
      subject.passedAt || (newSrsStage >= 5 ? createdAtEpoch : null);
    const startedAt = subject.startedAt || createdAtEpoch;

    const stage = stages[newSrsStage];
    const availableAt = this.calculateNextAvailableAt(stage, review.created_at);

    // Review statistic updates — always increment correct (review counts as completed)
    const meaningCorrect = subject.meaningCorrect + 1;
    const readingCorrect = subject.readingCorrect + 1;
    const meaningIncorrect = subject.meaningIncorrect + incorrectMeaning;
    const readingIncorrect = subject.readingIncorrect + incorrectReading;
    const meaningCurrentStreak =
      incorrectMeaning === 0 ? subject.meaningCurrentStreak + 1 : 1;
    const readingCurrentStreak =
      incorrectReading === 0 ? subject.readingCurrentStreak + 1 : 1;
    const meaningMaxStreak = Math.max(
      subject.meaningMaxStreak,
      meaningCurrentStreak,
    );
    const readingMaxStreak = Math.max(
      subject.readingMaxStreak,
      readingCurrentStreak,
    );
    const percentageCorrect = Math.round(
      (100 * (meaningCorrect + readingCorrect)) /
        (meaningCorrect + readingCorrect + meaningIncorrect + readingIncorrect),
    );

    await this.db.transaction(async (tx) => {
      await tx
        .update(schema.subject)
        .set({
          srsStage: newSrsStage,
          burnedAt,
          passedAt,
          startedAt,
          availableAt,
          lastIncorrectAnswer:
            incorrectAnswers > 0 ? createdAtEpoch : subject.lastIncorrectAnswer,
          meaningCorrect,
          readingCorrect,
          meaningIncorrect,
          readingIncorrect,
          meaningCurrentStreak,
          readingCurrentStreak,
          meaningMaxStreak,
          readingMaxStreak,
          percentageCorrect,
          assignmentPatched: 1,
          statisticPatched: 1,
          dataUpdatedAt: Date.now(),
        })
        .where(eq(schema.subject.id, subjectId));
    });

    // Side effects: level up + unlock subjects (own transactions)
    await this.handleSideEffects(subject.object ?? "", level);

    const [updated] = await this.db
      .select()
      .from(schema.subject)
      .where(eq(schema.subject.id, subjectId))
      .limit(1);

    return {
      subject: updated,
      startingSrsStage,
      endingSrsStage: newSrsStage,
      reviewCreatedAt: review.created_at,
    };
  }

  async startAssignment(
    startParams: AssignmentStartParams,
    assignmentId: number,
  ) {
    const startedAt = startParams.started_at ?? new Date();
    const startedAtEpoch = startedAt.getTime();
    const level = await this.getUserLevel();

    const [subject] = await this.db
      .select()
      .from(schema.subject)
      .where(eq(schema.subject.assignmentId, assignmentId))
      .limit(1);
    if (!subject) throw new Error("Assignment not found");

    const stages = await this.getSrsStages(level);
    const stage = stages[1];
    const availableAt = this.calculateNextAvailableAt(stage, startedAt);

    let reviewStatisticId = subject.reviewStatisticId;
    if (reviewStatisticId === 0) {
      const [{ maxId }] = await this.db
        .select({
          maxId: sql<number>`COALESCE(MAX(${schema.subject.reviewStatisticId}), 0)`,
        })
        .from(schema.subject);
      reviewStatisticId = maxId + 1;
    }

    const [levelProg] = await this.db
      .select()
      .from(schema.levelProgression)
      .where(eq(schema.levelProgression.level, subject.level))
      .limit(1);

    await this.db.transaction(async (tx) => {
      await tx
        .update(schema.subject)
        .set({
          srsStage: 1,
          startedAt: startedAtEpoch,
          availableAt,
          reviewStatisticId,
          assignmentPatched: 1,
          dataUpdatedAt: Date.now(),
        })
        .where(eq(schema.subject.id, subject.id));

      if (levelProg && !levelProg.startedAt) {
        await tx
          .update(schema.levelProgression)
          .set({ startedAt: startedAtEpoch, dataUpdatedAt: Date.now() })
          .where(eq(schema.levelProgression.id, levelProg.id));
      }
    });

    const [updated] = await this.db
      .select()
      .from(schema.subject)
      .where(eq(schema.subject.id, subject.id))
      .limit(1);

    return { subject: updated };
  }

  private async handleSideEffects(subjectType: string, currentLevel: number) {
    if (subjectType === "kana_vocabulary" || subjectType === "vocabulary")
      return;

    let level = currentLevel;

    if (subjectType === "kanji") {
      const leveledUp = await this.checkForLevelUp(level);
      if (leveledUp) {
        logger.info({ level }, "Level up!");
        level = await this.newLevelProgression(new Date(), level);
      }
    }

    await this.unlockSubjects(level);
  }

  async checkForLevelUp(level: number): Promise<boolean> {
    const [result] = await this.db
      .select({
        total: sql<number>`COUNT(*)`,
        passed: sql<number>`SUM(CASE WHEN ${schema.subject.passedAt} IS NOT NULL THEN 1 ELSE 0 END)`,
      })
      .from(schema.subject)
      .where(
        and(
          eq(schema.subject.object, "kanji"),
          eq(schema.subject.level, level),
        ),
      );

    if (!result || result.total === 0) return false;
    return Math.ceil((result.passed / result.total) * 100) >= 90;
  }

  private async unlockSubjects(level: number) {
    const passedRows = await this.db
      .select({ id: schema.subject.id })
      .from(schema.subject)
      .where(isNotNull(schema.subject.passedAt));
    const passedIds = new Set(passedRows.map((r) => r.id));

    const candidates = await this.db
      .select()
      .from(schema.subject)
      .where(
        and(
          lte(schema.subject.level, level),
          eq(schema.subject.assignmentId, 0),
        ),
      );

    const toUnlock = candidates.filter((c) => {
      const deps: number[] = c.componentSubjectIds
        ? JSON.parse(c.componentSubjectIds)
        : [];
      return deps.every((id) => passedIds.has(id));
    });

    if (!toUnlock.length) return;

    logger.info(`Unlocking ${toUnlock.length} subjects`);

    const [{ maxId }] = await this.db
      .select({
        maxId: sql<number>`COALESCE(MAX(${schema.subject.assignmentId}), 0)`,
      })
      .from(schema.subject);

    const now = Date.now();

    await this.db.transaction(async (tx) => {
      for (let i = 0; i < toUnlock.length; i++) {
        await tx
          .update(schema.subject)
          .set({
            assignmentId: maxId + i + 1,
            unlockedAt: now,
            srsStage: 0,
            passed: 0,
            resurrected: 0,
            assignmentPatched: 1,
            dataUpdatedAt: now,
          })
          .where(eq(schema.subject.id, toUnlock[i].id));
      }
    });
  }

  private async newLevelProgression(
    createdAt: Date,
    currentLevel: number,
  ): Promise<number> {
    const createdAtEpoch = createdAt.getTime();
    const newLevel = currentLevel + 1;

    await this.db.transaction(async (tx) => {
      await tx
        .update(schema.levelProgression)
        .set({ passedAt: createdAtEpoch, dataUpdatedAt: createdAtEpoch })
        .where(eq(schema.levelProgression.level, currentLevel));

      const [{ maxId }] = await tx
        .select({
          maxId: sql<number>`COALESCE(MAX(${schema.levelProgression.id}), 0)`,
        })
        .from(schema.levelProgression);

      await tx.insert(schema.levelProgression).values({
        id: maxId + 1,
        level: newLevel,
        createdAt: createdAtEpoch,
        unlockedAt: createdAtEpoch,
        abandonedAt: null,
        completedAt: null,
        passedAt: null,
        startedAt: null,
        dataUpdatedAt: createdAtEpoch,
      });

      await tx
        .update(schema.properties)
        .set({ value: String(newLevel) })
        .where(eq(schema.properties.name, "level"));
    });

    return newLevel;
  }

  private async getUserLevel(): Promise<number> {
    const [row] = await this.db
      .select()
      .from(schema.properties)
      .where(eq(schema.properties.name, "level"))
      .limit(1);
    return row ? Number(row.value) : 1;
  }

  private async getSrsStages(level: number): Promise<Stage[]> {
    const srsId = level > 2 ? 1 : 2;
    const [srs] = await this.db
      .select()
      .from(schema.srsSystem)
      .where(eq(schema.srsSystem.id, srsId))
      .limit(1);
    if (!srs) throw new Error("SRS not found");
    return JSON.parse(srs.stages || "[]");
  }

  private getNewSrsStage(
    currentSrsStage: number,
    incorrectAnswers: number,
  ): number {
    if (incorrectAnswers <= 0) return Math.min(currentSrsStage + 1, 9);
    const penaltyFactor = currentSrsStage >= 5 ? 2 : 1;
    const incorrectAdjustmentCount = Math.ceil(incorrectAnswers / 2);
    return Math.max(
      currentSrsStage - incorrectAdjustmentCount * penaltyFactor,
      1,
    );
  }

  private calculateNextAvailableAt(
    stage: Stage | undefined,
    createdAt?: Date | null,
  ): number | null {
    if (!stage?.interval) return null;
    const afterDuration = add(createdAt || new Date(), {
      [stage.interval_unit]: stage.interval,
    });
    return roundToNearestHours(afterDuration, {
      roundingMethod: "floor",
    }).getTime();
  }
}
