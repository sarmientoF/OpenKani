import { z } from "zod";

export const subjectTypeSchema = z.enum([
  "kana_vocabulary",
  "kanji",
  "radical",
  "vocabulary",
]);

export const csvArray = <T extends z.ZodTypeAny>(schema: T, delimiter = ",") =>
  z
    .string()
    .transform((v) => v.split(delimiter))
    .pipe(z.array(schema));

export const booleanFromString = z.preprocess((val) => {
  if (typeof val === "string") {
    return val.toLowerCase() === "true";
  }
  return val;
}, z.boolean());
