import type * as schema from "../db/schema";
import type {
  WKAssignmentData,
  WKLevelProgressionData,
  WKResource,
  WKReviewStatisticData,
  WKSrsSystemData,
  WKStudyMaterialData,
  WKSubjectData,
  WKUserData,
} from "./wanikani-api";

type SubjectInsert = typeof schema.subject.$inferInsert;
type LPInsert = typeof schema.levelProgression.$inferInsert;
type SrsInsert = typeof schema.srsSystem.$inferInsert;
type PropertiesInsert = typeof schema.properties.$inferInsert;

const TYPE_CODES: Record<string, number> = {
  radical: 0,
  kanji: 1,
  vocabulary: 2,
  kana_vocabulary: 3,
};

const toEpoch = (v: string | null | undefined): number | null =>
  v ? new Date(v).getTime() : null;

export function mergeToSubjectRows(
  subjects: WKResource<WKSubjectData>[],
  assignments: WKResource<WKAssignmentData>[],
  reviewStats: WKResource<WKReviewStatisticData>[],
  studyMaterials: WKResource<WKStudyMaterialData>[],
): SubjectInsert[] {
  const assignmentMap = new Map<number, WKResource<WKAssignmentData>>();
  for (const a of assignments) assignmentMap.set(a.data.subject_id, a);

  const statMap = new Map<number, WKResource<WKReviewStatisticData>>();
  for (const s of reviewStats) statMap.set(s.data.subject_id, s);

  const materialMap = new Map<number, WKResource<WKStudyMaterialData>>();
  for (const m of studyMaterials) materialMap.set(m.data.subject_id, m);

  return subjects.map((sub) => {
    const s = sub.data;
    const a = assignmentMap.get(sub.id);
    const rs = statMap.get(sub.id);
    const sm = materialMap.get(sub.id);

    const srsStage = a?.data.srs_stage ?? 0;
    const passedAt = toEpoch(a?.data.passed_at);

    return {
      id: sub.id,
      object: sub.object,
      typeCode: TYPE_CODES[sub.object] ?? 0,
      hiddenAt: toEpoch(s.hidden_at),
      lessonPosition: s.lesson_position,
      srsSystemId: s.spaced_repetition_system_id,
      level: s.level,
      characters: s.characters,
      slug: s.slug,
      documentUrl: s.document_url,
      meanings: JSON.stringify(s.meanings),
      meaningMnemonic: s.meaning_mnemonic,
      meaningHint: s.meaning_hint ?? null,
      auxiliaryMeanings: JSON.stringify(s.auxiliary_meanings),
      readings: s.readings ? JSON.stringify(s.readings) : null,
      readingMnemonic: s.reading_mnemonic ?? null,
      readingHint: s.reading_hint ?? null,
      componentSubjectIds: s.component_subject_ids
        ? JSON.stringify(s.component_subject_ids)
        : null,
      amalgamationSubjectIds: s.amalgamation_subject_ids
        ? JSON.stringify(s.amalgamation_subject_ids)
        : null,
      visuallySimilarSubjectIds: s.visually_similar_subject_ids
        ? JSON.stringify(s.visually_similar_subject_ids)
        : null,
      partsOfSpeech: s.parts_of_speech
        ? JSON.stringify(s.parts_of_speech)
        : null,
      contextSentences: s.context_sentences
        ? JSON.stringify(s.context_sentences)
        : null,
      pronunciationAudios: s.pronunciation_audios
        ? JSON.stringify(s.pronunciation_audios)
        : null,
      characterImages: s.character_images
        ? JSON.stringify(s.character_images)
        : null,
      audioDownloadStatus: 0,
      searchTarget: buildSearchTarget(s),
      smallSearchTarget: s.characters ?? s.slug,
      assignmentId: a?.id ?? 0,
      availableAt: toEpoch(a?.data.available_at),
      burnedAt: toEpoch(a?.data.burned_at),
      passedAt,
      resurrectedAt: toEpoch(a?.data.resurrected_at),
      startedAt: toEpoch(a?.data.started_at),
      unlockedAt: toEpoch(a?.data.unlocked_at),
      passed: passedAt ? 1 : 0,
      resurrected: a?.data.resurrected_at ? 1 : 0,
      srsStage,
      levelProgressScore: srsStage >= 5 ? 1 : 0,
      lastIncorrectAnswer: null,
      assignmentPatched: 0,
      studyMaterialId: sm?.id ?? 0,
      meaningNote: sm?.data.meaning_note ?? null,
      readingNote: sm?.data.reading_note ?? null,
      meaningSynonyms: sm?.data.meaning_synonyms
        ? JSON.stringify(sm.data.meaning_synonyms)
        : null,
      studyMaterialPatched: 0,
      reviewStatisticId: rs?.id ?? 0,
      meaningCorrect: rs?.data.meaning_correct ?? 0,
      meaningIncorrect: rs?.data.meaning_incorrect ?? 0,
      meaningMaxStreak: rs?.data.meaning_max_streak ?? 0,
      meaningCurrentStreak: rs?.data.meaning_current_streak ?? 0,
      readingCorrect: rs?.data.reading_correct ?? 0,
      readingIncorrect: rs?.data.reading_incorrect ?? 0,
      readingMaxStreak: rs?.data.reading_max_streak ?? 0,
      readingCurrentStreak: rs?.data.reading_current_streak ?? 0,
      percentageCorrect: rs?.data.percentage_correct ?? 0,
      leechScore: 0,
      statisticPatched: 0,
      frequency: 0,
      joyoGrade: 0,
      jlptLevel: 0,
      pitchInfo: null,
      strokeData: null,
      dataUpdatedAt: toEpoch(sub.data_updated_at),
    } satisfies SubjectInsert;
  });
}

function buildSearchTarget(s: WKSubjectData): string {
  const parts: string[] = [];
  if (s.characters) parts.push(s.characters);
  parts.push(s.slug);
  for (const m of s.meanings) parts.push(m.meaning);
  if (s.readings) {
    for (const r of s.readings) parts.push(r.reading);
  }
  return parts.join(" ");
}

export function toLevelProgressionRows(
  lps: WKResource<WKLevelProgressionData>[],
): LPInsert[] {
  return lps.map((lp) => ({
    id: lp.id,
    level: lp.data.level,
    createdAt: toEpoch(lp.data.created_at),
    unlockedAt: toEpoch(lp.data.unlocked_at),
    startedAt: toEpoch(lp.data.started_at),
    passedAt: toEpoch(lp.data.passed_at),
    completedAt: toEpoch(lp.data.completed_at),
    abandonedAt: toEpoch(lp.data.abandoned_at),
    dataUpdatedAt: toEpoch(lp.data_updated_at),
  }));
}

export function toSrsSystemRows(
  systems: WKResource<WKSrsSystemData>[],
): SrsInsert[] {
  return systems.map((sys) => ({
    id: sys.id,
    name: sys.data.name,
    description: sys.data.description,
    stages: JSON.stringify(sys.data.stages),
    unlockingStagePosition: sys.data.unlocking_stage_position,
    startingStagePosition: sys.data.starting_stage_position,
    passingStagePosition: sys.data.passing_stage_position,
    burningStagePosition: sys.data.burning_stage_position,
  }));
}

export function toPropertiesRows(
  user: WKResource<WKUserData>,
): PropertiesInsert[] {
  return [
    { name: "user_id", value: user.data.id },
    { name: "username", value: user.data.username },
    { name: "level", value: String(user.data.level) },
    { name: "profile_url", value: user.data.profile_url },
    { name: "started_at", value: user.data.started_at },
  ];
}
