import { Hono } from "hono";
import * as schema from "../db/schema";
import type { AuthEnv } from "../middleware/auth";

const app = new Hono<AuthEnv>();

app.get("/", async (c) => {
  const db = c.get("db");
  const baseUrl = c.get("baseUrl");
  const props = await db.select().from(schema.properties);
  const propsMap = Object.fromEntries(props.map((p) => [p.name, p.value]));

  return c.json(
    {
      object: "user",
      url: `${baseUrl}/user`,
      data_updated_at: new Date(),
      data: {
        id: propsMap["user_id"] ?? "",
        username: propsMap["username"] ?? "",
        level: Number(propsMap["level"] ?? "1"),
        profile_url: propsMap["profile_url"] ?? "",
        started_at: propsMap["started_at"]
          ? new Date(propsMap["started_at"])
          : null,
        current_vacation_started_at: null,
        subscription: {
          active: true,
          type: "lifetime",
          max_level_granted: 60,
          period_ends_at: null,
        },
        preferences: {
          default_voice_actor_id: 1,
          extra_study_autoplay_audio: false,
          lessons_autoplay_audio: false,
          lessons_batch_size: 5,
          lessons_presentation_order: "ascending_level_then_subject",
          reviews_autoplay_audio: false,
          reviews_display_srs_indicator: true,
          reviews_presentation_order: "shuffled",
        },
      },
    },
    200,
  );
});

export default app;
