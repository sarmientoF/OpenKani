import { z } from "zod";
import { csvArray } from "./constants";

export const levelProgressionParamsSchema = z.object({
  ids: csvArray(z.coerce.number()).optional(),
  updated_after: z.coerce.date().optional(),
});
