import { createMiddleware } from "hono/factory";

export const loggerMiddleware = createMiddleware(async (c, next) => {
  const req = c.req;
  const path = req.url.slice(req.url.indexOf("/", 8));
  const method = req.method;
  const body = await req.json().catch(() => undefined);

  await next();
  try {
    console.log(
      JSON.stringify({
        method,
        path,
        body,
        error: c.error?.message,
      }),
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        message: "Error logging response",
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  }
});
