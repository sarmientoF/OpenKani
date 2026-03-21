import { z } from "zod";

const reviewSchema = z.object({
  assignment_id: z.number().optional(),
  subject_id: z.number().optional(),
  incorrect_meaning_answers: z.number(),
  incorrect_reading_answers: z.number(),
  created_at: z.coerce.date().default(() => new Date()),
});

export type ReviewCreate = z.output<typeof reviewSchema>;

export const reviewCreateParamsSchema = z.object({
  review: reviewSchema,
});
