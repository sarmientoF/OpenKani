import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { collectionResponse } from "../helpers";
import type { AuthEnv } from "../middleware/auth";
import { reviewCreateParamsSchema } from "../schemas/reviews";
import { TursoReviewService } from "../services/review.service";
import { toAssignmentResponse, toReviewStatResponse } from "../transformers";

const app = new Hono<AuthEnv>();

// We don't store review history; return empty collection so clients don't 404.

app.get("/", async (c) => {
  const baseUrl = c.get("baseUrl");
  return c.json(collectionResponse([], `${baseUrl}/reviews`), 200);
});

app.post("/", zValidator("json", reviewCreateParamsSchema), async (c) => {
  const db = c.get("db");
  const baseUrl = c.get("baseUrl");
  const { review: reviewCreate } = c.req.valid("json");
  const reviewService = new TursoReviewService(db);

  const { subject, startingSrsStage, endingSrsStage, reviewCreatedAt } =
    await reviewService.updateReviewStatistics(reviewCreate);

  const assignment = toAssignmentResponse(subject!, baseUrl);
  const reviewStat = toReviewStatResponse(subject!, baseUrl);

  return c.json(
    {
      id: reviewStat.id,
      object: "review",
      data_updated_at: reviewCreatedAt,
      data: {
        assignment_id: subject!.assignmentId,
        created_at: reviewCreatedAt,
        ending_srs_stage: endingSrsStage,
        incorrect_meaning_answers: reviewCreate.incorrect_meaning_answers,
        incorrect_reading_answers: reviewCreate.incorrect_reading_answers,
        spaced_repetition_system_id: subject!.srsSystemId,
        starting_srs_stage: startingSrsStage,
        subject_id: subject!.id,
      },
      url: `${baseUrl}/reviews/${reviewStat.id}`,
      resources_updated: {
        assignment,
        review_statistic: reviewStat,
      },
    },
    201,
  );
});

export default app;
