import {
  type Client,
  createClient as createLibsqlClient,
} from "@libsql/client";
import { createClient as createTursoClient } from "@tursodatabase/api";
import { drizzle } from "drizzle-orm/libsql";
import md5 from "md5";
import * as schema from "../db/schema";
import { env } from "../env";

const turso = createTursoClient({
  token: env.TURSO_API_TOKEN,
  org: env.TURSO_ORG,
});

export function getDbNameForUser(userId: string): string {
  return md5(userId);
}

function getDbName(userId: string): string {
  return getDbNameForUser(userId);
}

function getDbUrl(dbName: string): string {
  return `libsql://${dbName}-${env.TURSO_ORG}.turso.io`;
}

const dbCache = new Map<string, ReturnType<typeof drizzle>>();
const migratedDbs = new Set<string>();

const MIGRATIONS = [
  "ALTER TABLE subject ADD COLUMN characterImages TEXT",
  "ALTER TABLE subject ADD COLUMN dataUpdatedAt INTEGER",
  "ALTER TABLE level_progression ADD COLUMN dataUpdatedAt INTEGER",
  "CREATE INDEX IF NOT EXISTS index_subject_dataUpdatedAt ON subject(dataUpdatedAt)",
  "CREATE INDEX IF NOT EXISTS index_lp_dataUpdatedAt ON level_progression(dataUpdatedAt)",
];

async function runMigrations(client: Client) {
  for (const sql of MIGRATIONS) {
    try {
      await client.execute(sql);
    } catch {
      /* already applied */
    }
  }
}

export async function getUserDb(userId: string) {
  const dbName = getDbName(userId);
  const cached = dbCache.get(dbName);
  if (cached) return cached;

  const url = getDbUrl(dbName);
  const client = createLibsqlClient({
    url,
    authToken: env.TURSO_GROUP_AUTH_TOKEN,
  });

  if (!migratedDbs.has(dbName)) {
    await runMigrations(client);
    migratedDbs.add(dbName);
  }

  const db = drizzle(client, { schema });
  dbCache.set(dbName, db);
  return db;
}

export type UserDb = Awaited<ReturnType<typeof getUserDb>>;

export async function createUserDb(userId: string): Promise<boolean> {
  const dbName = getDbName(userId);
  try {
    await turso.databases.create(dbName, {
      group: env.TURSO_GROUP,
      seed: {
        type: "database",
        name: env.TURSO_DATABASE_NAME,
      },
    });
    return true;
  } catch (err) {
    console.error("Error creating user database:", err);
    return false;
  }
}

export async function checkUserDbExists(userId: string): Promise<boolean> {
  const dbName = getDbName(userId);
  try {
    await turso.databases.get(dbName);
    return true;
  } catch {
    return false;
  }
}
