import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { migrateBodySchema, migrateQuerySchema } from "../schemas/migrate";
import {
  MigrationError,
  migrate,
  migrateWithProgress,
} from "../services/migration.service";
import { registerUser } from "../services/registry.service";
import { WKApiError } from "../services/wanikani-api";

const app = new Hono();

app.post(
  "/",
  zValidator("json", migrateBodySchema),
  zValidator("query", migrateQuerySchema),
  async (c) => {
    const { wanikani_api_key: apiKey } = c.req.valid("json");
    const { force } = c.req.valid("query");

    try {
      const result = await migrate(apiKey, force);
      const token = await registerUser(result.user_id);
      return c.json({ ...result, token }, 200);
    } catch (err: unknown) {
      if (err instanceof MigrationError) {
        if (err.status === 409 && err.userId) {
          const token = await registerUser(err.userId);
          return c.json({ error: err.message, token }, 409);
        }
        return c.json({ error: err.message }, err.status as 400);
      }
      if (err instanceof WKApiError) {
        const status = err.status === 401 ? 401 : 502;
        return c.json({ error: err.message }, status as 400);
      }
      throw err;
    }
  },
);

app.post(
  "/stream",
  zValidator("json", migrateBodySchema),
  zValidator("query", migrateQuerySchema),
  async (c) => {
    const { wanikani_api_key: apiKey } = c.req.valid("json");
    const { force } = c.req.valid("query");

    return streamSSE(c, async (stream) => {
      try {
        const result = await migrateWithProgress(
          apiKey,
          force,
          async (event) => {
            await stream.writeSSE({
              data: JSON.stringify(event),
              event: "progress",
            });
          },
        );
        const token = await registerUser(result.user_id);
        await stream.writeSSE({
          data: JSON.stringify({ ...result, token }),
          event: "completed",
        });
      } catch (err: unknown) {
        if (err instanceof MigrationError) {
          if (err.status === 409 && err.userId) {
            const token = await registerUser(err.userId);
            await stream.writeSSE({
              data: JSON.stringify({ error: err.message, token }),
              event: "completed",
            });
            return;
          }
          await stream.writeSSE({
            data: JSON.stringify({ error: err.message }),
            event: "error",
          });
          return;
        }
        if (err instanceof WKApiError) {
          await stream.writeSSE({
            data: JSON.stringify({ error: err.message }),
            event: "error",
          });
          return;
        }
        await stream.writeSSE({
          data: JSON.stringify({ error: "Internal server error" }),
          event: "error",
        });
      }
    });
  },
);

export default app;
