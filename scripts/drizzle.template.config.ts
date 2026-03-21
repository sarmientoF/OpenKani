import { defineConfig } from "drizzle-kit";

export default defineConfig({
	dialect: "turso",
	schema: "./src/db/schema.ts",
	dbCredentials: {
		url: `libsql://${process.env.TURSO_DATABASE_NAME}-${process.env.TURSO_ORG}.turso.io`,
		authToken: process.env.TURSO_GROUP_AUTH_TOKEN,
	},
});
