import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { db } from "./db";
import * as schema from "./db/schema";
import { env } from "$env/dynamic/private";

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,

  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema,
  }),

  emailAndPassword: {
    enabled: true,
  },

  secret: env.BETTER_AUTH_SECRET,
});