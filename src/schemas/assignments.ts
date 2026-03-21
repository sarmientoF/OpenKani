import { z } from "zod";
import { booleanFromString, csvArray, subjectTypeSchema } from "./constants";

export const assignmentStartParamSchema = z.object({
  id: z.coerce.number(),
});

export const assignmentStartBodySchema = z.object({
  started_at: z.coerce.date().optional(),
});

export const assignmentQuerySchema = z.object({
  available_after: z.coerce.date().optional(),
  available_before: z.coerce.date().optional(),
  burned: booleanFromString.optional(),
  hidden: booleanFromString.optional(),
  ids: csvArray(z.coerce.number()).optional(),
  immediately_available_for_lessons: booleanFromString.optional(),
  immediately_available_for_review: booleanFromString.optional(),
  in_review: booleanFromString.optional(),
  levels: csvArray(z.coerce.number()).optional(),
  srs_stages: csvArray(z.coerce.number()).optional(),
  started: booleanFromString.optional(),
  subject_ids: csvArray(z.coerce.number()).optional(),
  subject_types: csvArray(subjectTypeSchema).optional(),
  unlocked: booleanFromString.optional(),
  updated_after: z.coerce.date().optional(),
});
