import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import { env } from "$env/dynamic/private";

// libSQL (Turso) client. In production, TURSO_DATABASE_URL/TURSO_AUTH_TOKEN
// point at the hosted Turso database. With no env set (local dev), it falls
// back to a local SQLite file so you can develop offline against sqlite.db.
const client = createClient({
  url: env.TURSO_DATABASE_URL ?? "file:sqlite.db",
  authToken: env.TURSO_AUTH_TOKEN,
});

export const db = drizzle(client);
