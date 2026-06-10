import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { admin } from "better-auth/plugins";
import { db } from "./db";
import * as schema from "./db/schema";
import { env } from "$env/dynamic/private";

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,

  // localhost and 127.0.0.1 are different origins to the browser. Trust both on
  // the dev port so sign-in works regardless of which one you type (avoids the
  // "Invalid origin" error).
  trustedOrigins: ["http://localhost:5175", "http://127.0.0.1:5175"],

  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema,
  }),

  emailAndPassword: {
    enabled: true,
  },

  plugins: [
    admin({
      // New sign-ups get "user". An account is only an admin if its row in
      // the DB has role === "admin" (see scripts/make-admin — that's how
      // *only you* get access; nobody can self-promote through the UI).
      defaultRole: "user",
      adminRoles: ["admin"],
    }),
  ],

  secret: env.BETTER_AUTH_SECRET,
});