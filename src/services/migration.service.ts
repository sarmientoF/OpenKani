import { sql } from "drizzle-orm";
import * as schema from "../db/schema";
import {
  mergeToSubjectRows,
  toLevelProgressionRows,
  toPropertiesRows,
  toSrsSystemRows,
} from "./migration.transform";
import {
  checkUserDbExists,
  createUserDb,
  getDbNameForUser,
  getUserDb,
} from "./turso.service";
import { WaniKaniClient } from "./wanikani-api";

const BATCH_SIZE = 500;

export interface MigrationResult {
  status: "completed";
  user_id: string;
  db_name: string;
  counts: {
    subjects: number;
    assignments: number;
    review_statistics: number;
    study_materials: number;
    level_progressions: number;
    srs_systems: number;
  };
}

export interface MigrationProgressEvent {
  step: "fetching" | "inserting";
  entity?: string;
  count?: number;
  total?: number;
}

export type MigrationProgressCallback = (
  event: MigrationProgressEvent,
) => void | Promise<void>;

export async function migrate(
  apiKey: string,
  force?: boolean,
): Promise<MigrationResult> {
  return migrateWithProgress(apiKey, force);
}

export async function migrateWithProgress(
  apiKey: string,
  force?: boolean,
  onProgress?: MigrationProgressCallback,
): Promise<MigrationResult> {
  const client = new WaniKaniClient(apiKey);

  const user = await client.getUser();
  const userId = user.data.id;

  const exists = await checkUserDbExists(userId);
  if (exists && !force) {
    throw new MigrationError(
      409,
      "User DB already exists. Use ?force=true to re-migrate.",
      userId,
    );
  }
  if (!exists) {
    const ok = await createUserDb(userId);
    if (!ok) {
      throw new MigrationError(500, "Failed to create Turso DB");
    }
    await new Promise((r) => setTimeout(r, 3000));
  }

  const mkProgress = (entity: string) => (count: number, total: number) =>
    onProgress?.({ step: "fetching", entity, count, total });

  const [
    subjects,
    assignments,
    reviewStats,
    studyMaterials,
    levelProgressions,
    srsSystems,
  ] = await Promise.all([
    client.getAllSubjects(mkProgress("subjects")),
    client.getAllAssignments(mkProgress("assignments")),
    client.getAllReviewStatistics(mkProgress("review_statistics")),
    client.getAllStudyMaterials(mkProgress("study_materials")),
    client.getAllLevelProgressions(mkProgress("level_progressions")),
    client.getAllSrsSystems(mkProgress("srs_systems")),
  ]);

  const subjectRows = mergeToSubjectRows(
    subjects,
    assignments,
    reviewStats,
    studyMaterials,
  );
  const lpRows = toLevelProgressionRows(levelProgressions);
  const srsRows = toSrsSystemRows(srsSystems);
  const propRows = toPropertiesRows(user);

  const db = await getUserDb(userId);

  if (exists && force) {
    await db.delete(schema.subject);
    await db.delete(schema.levelProgression);
    await db.delete(schema.srsSystem);
    await db.delete(schema.properties);
  }

  for (let i = 0; i < subjectRows.length; i += BATCH_SIZE) {
    const batch = subjectRows.slice(i, i + BATCH_SIZE);
    await db.insert(schema.subject).values(batch).onConflictDoUpdate({
      target: schema.subject.id,
      set: buildSubjectConflictSet(),
    });
    await onProgress?.({
      step: "inserting",
      entity: "subjects",
      count: Math.min(i + BATCH_SIZE, subjectRows.length),
      total: subjectRows.length,
    });
  }

  for (const row of srsRows) {
    await db
      .insert(schema.srsSystem)
      .values(row)
      .onConflictDoUpdate({
        target: schema.srsSystem.id,
        set: {
          name: schema.srsSystem.name,
          description: schema.srsSystem.description,
          stages: schema.srsSystem.stages,
          unlockingStagePosition: schema.srsSystem.unlockingStagePosition,
          startingStagePosition: schema.srsSystem.startingStagePosition,
          passingStagePosition: schema.srsSystem.passingStagePosition,
          burningStagePosition: schema.srsSystem.burningStagePosition,
        },
      });
  }

  for (const row of lpRows) {
    await db
      .insert(schema.levelProgression)
      .values(row)
      .onConflictDoUpdate({
        target: schema.levelProgression.id,
        set: {
          abandonedAt: schema.levelProgression.abandonedAt,
          completedAt: schema.levelProgression.completedAt,
          createdAt: schema.levelProgression.createdAt,
          passedAt: schema.levelProgression.passedAt,
          startedAt: schema.levelProgression.startedAt,
          unlockedAt: schema.levelProgression.unlockedAt,
          level: schema.levelProgression.level,
          dataUpdatedAt: schema.levelProgression.dataUpdatedAt,
        },
      });
  }

  for (const row of propRows) {
    await db
      .insert(schema.properties)
      .values(row)
      .onConflictDoUpdate({
        target: schema.properties.name,
        set: { value: schema.properties.value },
      });
  }

  const [{ count: subjectCount }] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(schema.subject);

  return {
    status: "completed",
    user_id: userId,
    db_name: getDbNameForUser(userId),
    counts: {
      subjects: subjectCount,
      assignments: assignments.length,
      review_statistics: reviewStats.length,
      study_materials: studyMaterials.length,
      level_progressions: levelProgressions.length,
      srs_systems: srsSystems.length,
    },
  };
}

function buildSubjectConflictSet() {
  return {
    object: schema.subject.object,
    typeCode: schema.subject.typeCode,
    hiddenAt: schema.subject.hiddenAt,
    lessonPosition: schema.subject.lessonPosition,
    srsSystemId: schema.subject.srsSystemId,
    level: schema.subject.level,
    characters: schema.subject.characters,
    slug: schema.subject.slug,
    documentUrl: schema.subject.documentUrl,
    meanings: schema.subject.meanings,
    meaningMnemonic: schema.subject.meaningMnemonic,
    meaningHint: schema.subject.meaningHint,
    auxiliaryMeanings: schema.subject.auxiliaryMeanings,
    readings: schema.subject.readings,
    readingMnemonic: schema.subject.readingMnemonic,
    readingHint: schema.subject.readingHint,
    componentSubjectIds: schema.subject.componentSubjectIds,
    amalgamationSubjectIds: schema.subject.amalgamationSubjectIds,
    visuallySimilarSubjectIds: schema.subject.visuallySimilarSubjectIds,
    partsOfSpeech: schema.subject.partsOfSpeech,
    contextSentences: schema.subject.contextSentences,
    pronunciationAudios: schema.subject.pronunciationAudios,
    characterImages: schema.subject.characterImages,
    audioDownloadStatus: schema.subject.audioDownloadStatus,
    searchTarget: schema.subject.searchTarget,
    smallSearchTarget: schema.subject.smallSearchTarget,
    assignmentId: schema.subject.assignmentId,
    availableAt: schema.subject.availableAt,
    burnedAt: schema.subject.burnedAt,
    passedAt: schema.subject.passedAt,
    resurrectedAt: schema.subject.resurrectedAt,
    startedAt: schema.subject.startedAt,
    unlockedAt: schema.subject.unlockedAt,
    passed: schema.subject.passed,
    resurrected: schema.subject.resurrected,
    srsStage: schema.subject.srsStage,
    levelProgressScore: schema.subject.levelProgressScore,
    lastIncorrectAnswer: schema.subject.lastIncorrectAnswer,
    assignmentPatched: schema.subject.assignmentPatched,
    studyMaterialId: schema.subject.studyMaterialId,
    meaningNote: schema.subject.meaningNote,
    meaningSynonyms: schema.subject.meaningSynonyms,
    readingNote: schema.subject.readingNote,
    studyMaterialPatched: schema.subject.studyMaterialPatched,
    reviewStatisticId: schema.subject.reviewStatisticId,
    meaningCorrect: schema.subject.meaningCorrect,
    meaningIncorrect: schema.subject.meaningIncorrect,
    meaningMaxStreak: schema.subject.meaningMaxStreak,
    meaningCurrentStreak: schema.subject.meaningCurrentStreak,
    readingCorrect: schema.subject.readingCorrect,
    readingIncorrect: schema.subject.readingIncorrect,
    readingMaxStreak: schema.subject.readingMaxStreak,
    readingCurrentStreak: schema.subject.readingCurrentStreak,
    percentageCorrect: schema.subject.percentageCorrect,
    leechScore: schema.subject.leechScore,
    statisticPatched: schema.subject.statisticPatched,
    frequency: schema.subject.frequency,
    joyoGrade: schema.subject.joyoGrade,
    jlptLevel: schema.subject.jlptLevel,
    pitchInfo: schema.subject.pitchInfo,
    strokeData: schema.subject.strokeData,
    dataUpdatedAt: schema.subject.dataUpdatedAt,
  };
}

export class MigrationError extends Error {
  constructor(
    public status: number,
    message: string,
    public userId?: string,
  ) {
    super(message);
  }
}
