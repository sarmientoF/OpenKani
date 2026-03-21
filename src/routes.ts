import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { collectionResponse } from "./helpers";
import type { AuthEnv } from "./middleware/auth";
import { loggerMiddleware } from "./middleware/logger";
import assignments from "./routes/assignments";
import levelProgressions from "./routes/level-progressions";
import migrate from "./routes/migrate";
import reviewStatistics from "./routes/review-statistics";
import reviews from "./routes/reviews";
import spacedRepetitionSystems from "./routes/spaced-repetition-systems";
import studyMaterials from "./routes/study-materials";
import subjects from "./routes/subjects";
import summary from "./routes/summary";
import user from "./routes/user";
import { voiceActorParamsSchema } from "./schemas/voice-actors";

// Public routes (no auth required)
export const publicRoutes = new Hono();
publicRoutes.use(loggerMiddleware);
publicRoutes.route("/migrate", migrate);

// Protected routes (require Bearer token)
export const protectedRoutes = new Hono<AuthEnv>();
protectedRoutes.use(loggerMiddleware);

protectedRoutes.route("/assignments", assignments);
protectedRoutes.route("/subjects", subjects);
protectedRoutes.route("/reviews", reviews);
protectedRoutes.route("/review_statistics", reviewStatistics);
protectedRoutes.route("/study_materials", studyMaterials);
protectedRoutes.route("/level_progressions", levelProgressions);
protectedRoutes.route("/spaced_repetition_systems", spacedRepetitionSystems);
protectedRoutes.route("/summary", summary);
protectedRoutes.route("/user", user);

// Voice actors: not in schema, return empty collection
protectedRoutes.get(
  "/voice_actors",
  zValidator("query", voiceActorParamsSchema),
  async (c) =>
    c.json(collectionResponse([], `${c.get("baseUrl")}/voice_actors`), 200),
);
