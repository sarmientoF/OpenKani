import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { Hono } from "hono";
import * as schema from "../db/schema";
import type { AuthEnv } from "../middleware/auth";
import assignments from "../routes/assignments";
import reviews from "../routes/reviews";
import studyMaterials from "../routes/study-materials";
import subjects from "../routes/subjects";
import summary from "../routes/summary";
import user from "../routes/user";
import { TursoReviewService } from "../services/review.service";
import type { UserDb } from "../services/turso.service";

const DDL = `
  CREATE TABLE subject (
    id INTEGER PRIMARY KEY, object TEXT, typeCode INTEGER NOT NULL,
    hiddenAt INTEGER, lessonPosition INTEGER NOT NULL, srsSystemId INTEGER NOT NULL,
    level INTEGER NOT NULL, characters TEXT, slug TEXT, documentUrl TEXT,
    meanings TEXT, meaningMnemonic TEXT, meaningHint TEXT, auxiliaryMeanings TEXT,
    readings TEXT, readingMnemonic TEXT, readingHint TEXT,
    componentSubjectIds TEXT, amalgamationSubjectIds TEXT, visuallySimilarSubjectIds TEXT,
    partsOfSpeech TEXT, contextSentences TEXT, pronunciationAudios TEXT,
    audioDownloadStatus INTEGER NOT NULL, searchTarget TEXT, smallSearchTarget TEXT,
    assignmentId INTEGER NOT NULL, availableAt INTEGER, burnedAt INTEGER,
    passedAt INTEGER, resurrectedAt INTEGER, startedAt INTEGER, unlockedAt INTEGER,
    passed INTEGER NOT NULL, resurrected INTEGER NOT NULL,
    srsStage INTEGER NOT NULL, levelProgressScore INTEGER NOT NULL,
    lastIncorrectAnswer INTEGER, assignmentPatched INTEGER NOT NULL,
    studyMaterialId INTEGER NOT NULL, meaningNote TEXT, meaningSynonyms TEXT,
    readingNote TEXT, studyMaterialPatched INTEGER NOT NULL,
    reviewStatisticId INTEGER NOT NULL,
    meaningCorrect INTEGER NOT NULL, meaningIncorrect INTEGER NOT NULL,
    meaningMaxStreak INTEGER NOT NULL, meaningCurrentStreak INTEGER NOT NULL,
    readingCorrect INTEGER NOT NULL, readingIncorrect INTEGER NOT NULL,
    readingMaxStreak INTEGER NOT NULL, readingCurrentStreak INTEGER NOT NULL,
    percentageCorrect INTEGER NOT NULL, leechScore INTEGER NOT NULL,
    statisticPatched INTEGER NOT NULL,
    frequency INTEGER NOT NULL, joyoGrade INTEGER NOT NULL, jlptLevel INTEGER NOT NULL,
    pitchInfo TEXT, strokeData TEXT, characterImages TEXT, dataUpdatedAt INTEGER
  );
  CREATE TABLE srs_system (
    id INTEGER PRIMARY KEY, name TEXT, description TEXT, stages TEXT,
    unlockingStagePosition INTEGER NOT NULL, startingStagePosition INTEGER NOT NULL,
    passingStagePosition INTEGER NOT NULL, burningStagePosition INTEGER NOT NULL
  );
  CREATE TABLE level_progression (
    id INTEGER PRIMARY KEY, abandonedAt INTEGER, completedAt INTEGER,
    createdAt INTEGER, passedAt INTEGER, startedAt INTEGER,
    unlockedAt INTEGER, level INTEGER NOT NULL, dataUpdatedAt INTEGER
  );
  CREATE TABLE properties (
    name TEXT PRIMARY KEY, value TEXT NOT NULL
  );
`;

export type TestDb = ReturnType<typeof drizzle<typeof schema>>;

export function createTestDb(): TestDb {
  const sqlite = new Database(":memory:");
  sqlite.exec(DDL);
  return drizzle(sqlite, { schema });
}

export function createService(db: TestDb): TursoReviewService {
  return new TursoReviewService(db as unknown as UserDb);
}

/** Accelerated SRS system (used for level 1-2) */
export const ACCELERATED_SRS = {
  id: 2,
  name: "Accelerated",
  description: "Accelerated SRS for levels 1-2",
  unlockingStagePosition: 0,
  startingStagePosition: 1,
  passingStagePosition: 5,
  burningStagePosition: 9,
  stages: JSON.stringify([
    { position: 0, interval: null, interval_unit: "seconds" },
    { position: 1, interval: 7200, interval_unit: "seconds" },
    { position: 2, interval: 14400, interval_unit: "seconds" },
    { position: 3, interval: 28800, interval_unit: "seconds" },
    { position: 4, interval: 82800, interval_unit: "seconds" },
    { position: 5, interval: 601200, interval_unit: "seconds" },
    { position: 6, interval: 1206000, interval_unit: "seconds" },
    { position: 7, interval: 2588400, interval_unit: "seconds" },
    { position: 8, interval: 10364400, interval_unit: "seconds" },
    { position: 9, interval: null, interval_unit: "seconds" },
  ]),
};

/** Default SRS system (used for level 3+) */
export const DEFAULT_SRS = {
  id: 1,
  name: "Default",
  description: "Default SRS system",
  unlockingStagePosition: 0,
  startingStagePosition: 1,
  passingStagePosition: 5,
  burningStagePosition: 9,
  stages: JSON.stringify([
    { position: 0, interval: null, interval_unit: "seconds" },
    { position: 1, interval: 14400, interval_unit: "seconds" },
    { position: 2, interval: 28800, interval_unit: "seconds" },
    { position: 3, interval: 82800, interval_unit: "seconds" },
    { position: 4, interval: 601200, interval_unit: "seconds" },
    { position: 5, interval: 1206000, interval_unit: "seconds" },
    { position: 6, interval: 2588400, interval_unit: "seconds" },
    { position: 7, interval: 10364400, interval_unit: "seconds" },
    { position: 8, interval: 31536000, interval_unit: "seconds" },
    { position: 9, interval: null, interval_unit: "seconds" },
  ]),
};

/** Default values for subject fields not relevant to a specific test */
export const SUBJECT_DEFAULTS = {
  typeCode: 0,
  lessonPosition: 0,
  audioDownloadStatus: 0,
  passed: 0,
  resurrected: 0,
  levelProgressScore: 0,
  assignmentPatched: 0,
  studyMaterialId: 0,
  studyMaterialPatched: 0,
  statisticPatched: 0,
  leechScore: 0,
  frequency: 0,
  joyoGrade: 0,
  jlptLevel: 0,
  meaningCorrect: 0,
  meaningIncorrect: 0,
  meaningMaxStreak: 0,
  meaningCurrentStreak: 0,
  readingCorrect: 0,
  readingIncorrect: 0,
  readingMaxStreak: 0,
  readingCurrentStreak: 0,
  percentageCorrect: 0,
  reviewStatisticId: 0,
} as const;

export function seedSrsSystem(db: TestDb, srs = ACCELERATED_SRS) {
  db.insert(schema.srsSystem).values(srs).run();
}

export function seedBothSrs(db: TestDb) {
  seedSrsSystem(db, DEFAULT_SRS);
  seedSrsSystem(db, ACCELERATED_SRS);
}

export function seedLevel(db: TestDb, level: number) {
  db.insert(schema.properties)
    .values({ name: "level", value: String(level) })
    .run();
}

export function seedLevelProgression(
  db: TestDb,
  id: number,
  level: number,
  opts: { startedAt?: number | null; passedAt?: number | null } = {},
) {
  db.insert(schema.levelProgression)
    .values({
      id,
      level,
      createdAt: Date.now(),
      unlockedAt: Date.now(),
      startedAt: opts.startedAt ?? null,
      passedAt: opts.passedAt ?? null,
    })
    .run();
}

export function seedSubject(
  db: TestDb,
  overrides: Partial<typeof schema.subject.$inferInsert> & {
    id: number;
    level: number;
    srsSystemId: number;
    assignmentId: number;
    srsStage: number;
  },
) {
  db.insert(schema.subject)
    .values({ ...SUBJECT_DEFAULTS, ...overrides })
    .run();
}

export function createTestApp(db: TestDb): Hono<AuthEnv> {
  const app = new Hono<AuthEnv>();
  app.onError((err, c) => {
    return c.json({ error: err.message }, 500);
  });
  app.use(async (c, next) => {
    c.set("db", db as unknown as UserDb);
    c.set("userId", "test-user");
    c.set("baseUrl", "http://localhost/v2");
    await next();
  });
  app.route("/v2/assignments", assignments);
  app.route("/v2/subjects", subjects);
  app.route("/v2/reviews", reviews);
  app.route("/v2/study_materials", studyMaterials);
  app.route("/v2/summary", summary);
  app.route("/v2/user", user);
  return app;
}

export function seedProperty(db: TestDb, name: string, value: string) {
  db.insert(schema.properties).values({ name, value }).run();
}

export { schema };
