import { db } from "$lib/server/db";

export const GET = async () => {
  const result = db.all("SELECT 1 AS test");

  return new Response(JSON.stringify(result));
};