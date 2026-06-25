import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import { env } from "$env/dynamic/private";
import * as schema from "./schema";

// libSQL (Turso) client. In production, TURSO_DATABASE_URL/TURSO_AUTH_TOKEN
// point at the hosted Turso database. With no env set (local dev), it falls
// back to a local SQLite file so you can develop offline against sqlite.db.
const client = createClient({
  url: env.TURSO_DATABASE_URL ?? "file:sqlite.db",
  authToken: env.TURSO_AUTH_TOKEN,
});

// Pass the schema so the relational query API (db.query.orders.findMany({ with }))
// can resolve the order ↔ client ↔ glassType relations.
export const db = drizzle(client, { schema });
