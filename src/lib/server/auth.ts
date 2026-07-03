import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { admin } from "better-auth/plugins";
import { Resend } from "resend";
import { db } from "./db";
import * as schema from "./db/schema";
import { env } from "$env/dynamic/private";

// Resend sends the password-reset emails. Needs RESEND_API_KEY set (local +
// Vercel). EMAIL_FROM must be an address on a domain you've verified in Resend;
// the onboarding@resend.dev fallback only delivers to your own Resend account
// email, so it's for testing only.
//
// Created lazily: Resend's constructor throws if the key is missing, and this
// module is imported at build time (route analysis) where env vars aren't set —
// instantiating at module load would break the build.
const FROM = env.EMAIL_FROM ?? "onboarding@resend.dev";
let resend: Resend | null = null;
function getResend(): Resend {
  if (!resend) {
    if (!env.RESEND_API_KEY) throw new Error("RESEND_API_KEY is not set");
    resend = new Resend(env.RESEND_API_KEY);
  }
  return resend;
}

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,

  // Better Auth rejects any request whose browser Origin isn't listed here
  // ("Invalid origin"). We trust:
  //  - localhost / 127.0.0.1 on the dev port (both are distinct origins),
  //  - the deployed production origin via BETTER_AUTH_URL,
  //  - any extra origins from TRUSTED_ORIGINS (comma-separated). Put your prod
  //    domain and/or a preview wildcard there, e.g.:
  //      TRUSTED_ORIGINS=https://onzaaa.vercel.app,https://*.vercel.app
  trustedOrigins: [
    "http://localhost:5175",
    "http://127.0.0.1:5175",
    ...(env.BETTER_AUTH_URL ? [env.BETTER_AUTH_URL] : []),
    ...(env.TRUSTED_ORIGINS
      ? env.TRUSTED_ORIGINS.split(",")
          .map((o) => o.trim())
          .filter(Boolean)
      : []),
  ],

  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema,
  }),

  emailAndPassword: {
    enabled: true,
    // Sent when a user requests a reset from /login. `url` already contains the
    // reset token and points at our /reset-password page (see redirectTo on the
    // client). The reset page reads the token and calls resetPassword().
    sendResetPassword: async ({ user, url }) => {
      await getResend().emails.send({
        from: FROM,
        to: user.email,
        subject: "Reset your password",
        html: `
          <p>Hi ${user.name ?? "there"},</p>
          <p>We received a request to reset your password. Click the link below
          to choose a new one. If you didn't request this, you can ignore this email.</p>
          <p><a href="${url}">Reset your password</a></p>
          <p>This link expires shortly for your security.</p>
        `,
      });
    },
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