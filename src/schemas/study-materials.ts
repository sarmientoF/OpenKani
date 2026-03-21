import { z } from "zod";
import { csvArray } from "./constants";

export const studyMaterialCreateParamsSchema = z.object({
  subject_id: z.number(),
  meaning_note: z.string().optional(),
  reading_note: z.string().optional(),
  meaning_synonyms: z.array(z.string()).default([]),
});

export const studyMaterialUpdateParamsSchema = z.object({
  id: z.coerce.number(),
});

export const studyMaterialUpdateBodySchema = z.object({
  meaning_note: z.string().optional(),
  reading_note: z.string().optional(),
  meaning_synonyms: z.array(z.string()).optional(),
});

export const studyMaterialParamsSchema = z.object({
  hidden: z.boolean().optional(),
  ids: csvArray(z.coerce.number()).optional(),
  subject_ids: csvArray(z.coerce.number()).optional(),
  subject_types: csvArray(z.string()).optional(),
  updated_after: z.coerce.date().optional(),
});
