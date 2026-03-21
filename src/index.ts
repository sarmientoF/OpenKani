import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import { authMiddleware } from "./middleware/auth";
import { protectedRoutes, publicRoutes } from "./routes";

const app = new Hono();

app.use(cors());
app.use(logger());
app.use(prettyJSON());

// Public routes (no auth): /v2/migrate
app.route("/v2", publicRoutes);

// Protected routes (require Bearer token): all other /v2/* endpoints
app.use("/v2/*", authMiddleware);
app.route("/v2", protectedRoutes);

app.get("/", async (c) => {
  return c.json(
    {
      now: new Date(),
      message: "ok ✅",
      path: c.req.path,
      url: c.req.url,
      host: c.req.header("Host"),
    },
    200,
  );
});

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status);
  }
  if (err instanceof Error) {
    return c.text(`Error: ${err.message}`, 500);
  }
  return c.text("An unknown error occurred", 500);
});

export default app;
