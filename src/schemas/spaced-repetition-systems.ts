import { z } from "zod";
import { csvArray } from "./constants";

export const spacedRepetitionParamsSchema = z.object({
  ids: csvArray(z.coerce.number()).optional(),
  updated_after: z.coerce.date().optional(), // static data, no filtering needed
});
