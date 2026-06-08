import { createAuthClient } from "better-auth/svelte";

// Same-origin: no baseURL needed — the client calls /api/auth/* on this app.
export const authClient = createAuthClient();
