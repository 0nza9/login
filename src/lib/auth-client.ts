import { createAuthClient } from "better-auth/svelte";
import { adminClient } from "better-auth/client/plugins";

// Same-origin: no baseURL needed — the client calls /api/auth/* on this app.
export const authClient = createAuthClient({
  plugins: [adminClient()],
});
