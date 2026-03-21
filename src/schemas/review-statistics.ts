import { z } from "zod";
import { booleanFromString, csvArray, subjectTypeSchema } from "./constants";

export const reviewStatisticsParamsSchema = z.object({
  hidden: booleanFromString.optional(),
  ids: csvArray(z.coerce.number()).optional(),
  percentages_greater_than: z.number().optional(),
  percentages_less_than: z.number().optional(),
  subject_ids: csvArray(z.coerce.number()).optional(),
  subject_types: csvArray(subjectTypeSchema).optional(),
  updated_after: z.coerce.date().optional(),
});
