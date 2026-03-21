import { z } from "zod";
import { booleanFromString, csvArray, subjectTypeSchema } from "./constants";

export const subjectParametersSchema = z.object({
  ids: csvArray(z.coerce.number()).optional(),
  types: csvArray(subjectTypeSchema).optional(),
  slugs: csvArray(z.string()).optional(),
  levels: csvArray(z.coerce.number()).optional(),
  hidden: booleanFromString.optional(),
  updated_after: z.coerce.date().optional(),
  page_after_id: z.coerce.number().optional(),
  page_before_id: z.coerce.number().optional(),
});
