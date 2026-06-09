import { redirect, fail } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
import { auth } from "$lib/server/auth";
import { db } from "$lib/server/db";
import { user as userTable } from "$lib/server/db/schema";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, request }) => {
  // Must be signed in to see the dashboard at all.
  if (!locals.user) throw redirect(302, "/login");

  const isAdmin = locals.user.role === "admin";

  // Only admins get the user list. Non-admins just see their own info.
  // listUsers re-checks the caller's admin role server-side via the request
  // headers, so this can't be reached by a non-admin.
  let users: Awaited<ReturnType<typeof auth.api.listUsers>>["users"] = [];
  if (isAdmin) {
    const result = await auth.api.listUsers({
      query: { limit: 100, sortBy: "createdAt", sortDirection: "desc" },
      headers: request.headers,
    });
    users = result.users ?? [];
  }

  return { me: locals.user, isAdmin, users };
};

// Every action re-checks admin on the server, so even a crafted request from a
// non-admin is rejected here — the UI being hidden is not the security boundary.
function requireAdmin(locals: App.Locals) {
  if (!locals.user || locals.user.role !== "admin") {
    throw redirect(302, "/dashboard");
  }
}

export const actions: Actions = {
  setRole: async ({ request, locals }) => {
    requireAdmin(locals);
    const form = await request.formData();
    const userId = String(form.get("userId"));
    const role = String(form.get("role")) as "admin" | "user";
    if (!userId || (role !== "admin" && role !== "user")) {
      return fail(400, { message: "Invalid role change." });
    }
    await auth.api.setRole({
      body: { userId, role },
      headers: request.headers,
    });
    return { success: true };
  },

  updateName: async ({ request, locals }) => {
    requireAdmin(locals);
    const form = await request.formData();
    const userId = String(form.get("userId"));
    const name = String(form.get("name")).trim();
    if (!userId || !name) return fail(400, { message: "Name required." });
    // The admin plugin has no "edit another user's profile" endpoint, so write
    // the name directly. This action already enforced admin via requireAdmin().
    await db
      .update(userTable)
      .set({ name, updatedAt: new Date() })
      .where(eq(userTable.id, userId));
    return { success: true };
  },

  ban: async ({ request, locals }) => {
    requireAdmin(locals);
    const form = await request.formData();
    const userId = String(form.get("userId"));
    // Don't let an admin ban themselves out of the dashboard.
    if (userId === locals.user!.id) {
      return fail(400, { message: "You can't ban yourself." });
    }
    await auth.api.banUser({
      body: { userId, banReason: "Banned by admin" },
      headers: request.headers,
    });
    return { success: true };
  },

  unban: async ({ request, locals }) => {
    requireAdmin(locals);
    const form = await request.formData();
    const userId = String(form.get("userId"));
    await auth.api.unbanUser({
      body: { userId },
      headers: request.headers,
    });
    return { success: true };
  },

  remove: async ({ request, locals }) => {
    requireAdmin(locals);
    const form = await request.formData();
    const userId = String(form.get("userId"));
    if (userId === locals.user!.id) {
      return fail(400, { message: "You can't delete yourself." });
    }
    await auth.api.removeUser({
      body: { userId },
      headers: request.headers,
    });
    return { success: true };
  },
};
