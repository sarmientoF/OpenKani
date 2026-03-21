import type * as schema from "./db/schema";
import { parseJson, toDate } from "./helpers";

type SubjectRow = typeof schema.subject.$inferSelect;
type LPRow = typeof schema.levelProgression.$inferSelect;
type SrsRow = typeof schema.srsSystem.$inferSelect;

export function toAssignmentResponse(row: SubjectRow, baseUrl: string) {
  return {
    id: row.assignmentId,
    object: "assignment" as const,
    url: `${baseUrl}/assignments/${row.assignmentId}`,
    data_updated_at: toDate(row.dataUpdatedAt) ?? new Date(),
    data: {
      available_at: toDate(row.availableAt),
      burned_at: toDate(row.burnedAt),
      created_at: toDate(row.unlockedAt) ?? new Date(),
      hidden: !!row.hiddenAt,
      passed_at: toDate(row.passedAt),
      resurrected_at: toDate(row.resurrectedAt),
      srs_stage: row.srsStage,
      started_at: toDate(row.startedAt),
      subject_id: row.id,
      subject_type: row.object ?? "radical",
      unlocked_at: toDate(row.unlockedAt),
    },
  };
}

export function toReviewStatResponse(row: SubjectRow, baseUrl: string) {
  return {
    id: row.reviewStatisticId,
    object: "review_statistic" as const,
    url: `${baseUrl}/review_statistics/${row.reviewStatisticId}`,
    data_updated_at: toDate(row.dataUpdatedAt) ?? new Date(),
    data: {
      created_at: toDate(row.unlockedAt) ?? new Date(),
      hidden: !!row.hiddenAt,
      meaning_correct: row.meaningCorrect,
      meaning_current_streak: row.meaningCurrentStreak,
      meaning_incorrect: row.meaningIncorrect,
      meaning_max_streak: row.meaningMaxStreak,
      percentage_correct: row.percentageCorrect,
      reading_correct: row.readingCorrect,
      reading_current_streak: row.readingCurrentStreak,
      reading_incorrect: row.readingIncorrect,
      reading_max_streak: row.readingMaxStreak,
      subject_id: row.id,
      subject_type: row.object ?? "radical",
    },
  };
}

export function toStudyMaterialResponse(row: SubjectRow, baseUrl: string) {
  return {
    id: row.studyMaterialId,
    object: "study_material" as const,
    url: `${baseUrl}/study_materials/${row.studyMaterialId}`,
    data_updated_at: toDate(row.dataUpdatedAt) ?? new Date(),
    data: {
      created_at: toDate(row.unlockedAt) ?? new Date(),
      hidden: !!row.hiddenAt,
      meaning_note: row.meaningNote,
      meaning_synonyms: parseJson<string[]>(row.meaningSynonyms, []),
      reading_note: row.readingNote,
      subject_id: row.id,
      subject_type: row.object ?? "radical",
    },
  };
}

export function toSubjectResponse(row: SubjectRow, baseUrl: string) {
  const objectType = row.object ?? "radical";
  const meanings = parseJson(row.meanings, []);
  const auxiliaryMeanings = parseJson(row.auxiliaryMeanings, []);
  const readings = parseJson(row.readings, []);
  const componentSubjectIds = parseJson<number[]>(row.componentSubjectIds, []);
  const amalgamationSubjectIds = parseJson<number[]>(
    row.amalgamationSubjectIds,
    [],
  );

  const commonData = {
    auxiliary_meanings: auxiliaryMeanings,
    characters: row.characters,
    created_at: new Date(),
    document_url: row.documentUrl ?? "",
    hidden_at: toDate(row.hiddenAt),
    lesson_position: row.lessonPosition,
    level: row.level,
    meaning_mnemonic: row.meaningMnemonic ?? "",
    meanings,
    slug: row.slug ?? "",
    spaced_repetition_system_id: row.srsSystemId,
  };

  let data: Record<string, unknown>;

  switch (objectType) {
    case "radical":
      data = {
        ...commonData,
        amalgamation_subject_ids: amalgamationSubjectIds,
        character_images: parseJson(row.characterImages, []),
      };
      break;
    case "kanji":
      data = {
        ...commonData,
        amalgamation_subject_ids: amalgamationSubjectIds,
        component_subject_ids: componentSubjectIds,
        meaning_hint: row.meaningHint,
        reading_hint: row.readingHint,
        reading_mnemonic: row.readingMnemonic ?? "",
        readings,
        visually_similar_subject_ids: parseJson<number[]>(
          row.visuallySimilarSubjectIds,
          [],
        ),
      };
      break;
    case "vocabulary":
      data = {
        ...commonData,
        component_subject_ids: componentSubjectIds,
        context_sentences: parseJson(row.contextSentences, []),
        parts_of_speech: parseJson<string[]>(row.partsOfSpeech, []),
        pronunciation_audios: parseJson(row.pronunciationAudios, []),
        reading_mnemonic: row.readingMnemonic ?? "",
        readings,
      };
      break;
    case "kana_vocabulary":
      data = {
        ...commonData,
        context_sentences: parseJson(row.contextSentences, []),
        parts_of_speech: parseJson<string[]>(row.partsOfSpeech, []),
        pronunciation_audios: parseJson(row.pronunciationAudios, []),
      };
      break;
    default:
      data = commonData;
  }

  return {
    id: row.id,
    object: objectType,
    url: `${baseUrl}/subjects/${row.id}`,
    data_updated_at: toDate(row.dataUpdatedAt) ?? new Date(),
    data,
  };
}

export function toLevelProgressionResponse(row: LPRow, baseUrl: string) {
  return {
    id: row.id,
    object: "level_progression" as const,
    url: `${baseUrl}/level_progressions/${row.id}`,
    data_updated_at: toDate(row.dataUpdatedAt) ?? new Date(),
    data: {
      abandoned_at: toDate(row.abandonedAt),
      completed_at: toDate(row.completedAt),
      created_at: toDate(row.createdAt) ?? new Date(),
      level: row.level,
      passed_at: toDate(row.passedAt),
      started_at: toDate(row.startedAt),
      unlocked_at: toDate(row.unlockedAt),
    },
  };
}

export function toSrsSystemResponse(row: SrsRow, baseUrl: string) {
  return {
    id: row.id,
    object: "spaced_repetition_system" as const,
    url: `${baseUrl}/spaced_repetition_systems/${row.id}`,
    data_updated_at: new Date(),
    data: {
      burning_stage_position: row.burningStagePosition,
      created_at: new Date(),
      description: row.description ?? "",
      name: row.name ?? "",
      passing_stage_position: row.passingStagePosition,
      stages: parseJson(row.stages, []),
      starting_stage_position: row.startingStagePosition,
      unlocking_stage_position: row.unlockingStagePosition,
    },
  };
}
