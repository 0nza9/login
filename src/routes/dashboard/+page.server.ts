import { redirect, fail } from "@sveltejs/kit";
import { eq, count } from "drizzle-orm";
import { auth } from "$lib/server/auth";
import { db } from "$lib/server/db";
import { user as userTable } from "$lib/server/db/schema";
import type { Actions, PageServerLoad } from "./$types";

const PAGE_SIZE = 10;

// better-auth throws APIError on failure; pull the human message out of it so we
// can surface it to the admin via a toast instead of a generic error.
function errMessage(e: unknown): string {
  const any = e as { body?: { message?: string }; message?: string };
  return any?.body?.message ?? any?.message ?? "Something went wrong.";
}

// Global counts for the stats header (independent of the current search/page).
async function getStats() {
  const [tot] = await db.select({ c: count() }).from(userTable);
  const [adm] = await db
    .select({ c: count() })
    .from(userTable)
    .where(eq(userTable.role, "admin"));
  const [ban] = await db
    .select({ c: count() })
    .from(userTable)
    .where(eq(userTable.banned, true));
  return { total: tot.c, admins: adm.c, banned: ban.c };
}

export const load: PageServerLoad = async ({ locals, request, url }) => {
  // Must be signed in to see the dashboard at all.
  if (!locals.user) throw redirect(302, "/login");

  const isAdmin = locals.user.role === "admin";
  // When an admin "logs in as" someone, better-auth records it on the session.
  const impersonating = Boolean(locals.session?.impersonatedBy);

  // Non-admins just see their own info — no user list, no stats.
  if (!isAdmin) {
    return {
      me: locals.user,
      isAdmin,
      impersonating,
      users: [],
      total: 0,
      page: 1,
      pageSize: PAGE_SIZE,
      q: "",
      field: "email" as const,
      stats: null,
      selectedUser: null,
      sessions: [],
    };
  }

  // --- Search + pagination state from the URL (so it's shareable/back-able). ---
  const q = (url.searchParams.get("q") ?? "").trim();
  const field = url.searchParams.get("field") === "name" ? "name" : "email";
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  // listUsers re-checks the caller's admin role server-side via the headers.
  const result = await auth.api.listUsers({
    query: {
      limit: PAGE_SIZE,
      offset,
      sortBy: "createdAt",
      sortDirection: "desc",
      ...(q ? { searchValue: q, searchField: field, searchOperator: "contains" } : {}),
    },
    headers: request.headers,
  });

  const stats = await getStats();

  // --- "Manage one user" drawer: ?manage=<userId> loads that user + sessions. ---
  const manageId = url.searchParams.get("manage");
  let selectedUser: (typeof result.users)[number] | null = null;
  let sessions: Awaited<ReturnType<typeof auth.api.listUserSessions>>["sessions"] = [];
  if (manageId) {
    selectedUser = result.users.find((u) => u.id === manageId) ?? null;
    // The user might not be on the current page — fall back to a direct lookup.
    if (!selectedUser) {
      const rows = await db
        .select()
        .from(userTable)
        .where(eq(userTable.id, manageId))
        .limit(1);
      selectedUser = (rows[0] as (typeof result.users)[number]) ?? null;
    }
    if (selectedUser) {
      const s = await auth.api.listUserSessions({
        body: { userId: manageId },
        headers: request.headers,
      });
      sessions = s.sessions ?? [];
    }
  }

  return {
    me: locals.user,
    isAdmin,
    impersonating,
    users: result.users ?? [],
    total: result.total ?? 0,
    page,
    pageSize: PAGE_SIZE,
    q,
    field,
    stats,
    selectedUser,
    sessions,
  };
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
      return fail(400, { action: "setRole", message: "Invalid role change." });
    }
    try {
      await auth.api.setRole({ body: { userId, role }, headers: request.headers });
    } catch (e) {
      return fail(400, { action: "setRole", message: errMessage(e) });
    }
    return { action: "setRole", success: true, message: `Role set to ${role}.` };
  },

  updateName: async ({ request, locals }) => {
    requireAdmin(locals);
    const form = await request.formData();
    const userId = String(form.get("userId"));
    const name = String(form.get("name")).trim();
    if (!userId || !name)
      return fail(400, { action: "updateName", message: "Name required." });
    // The admin plugin has no "edit another user's profile" endpoint, so write
    // the name directly. This action already enforced admin via requireAdmin().
    await db
      .update(userTable)
      .set({ name, updatedAt: new Date() })
      .where(eq(userTable.id, userId));
    return { action: "updateName", success: true, message: "Name updated." };
  },

  createUser: async ({ request, locals }) => {
    requireAdmin(locals);
    const form = await request.formData();
    const email = String(form.get("email")).trim().toLowerCase();
    const name = String(form.get("name")).trim();
    const password = String(form.get("password"));
    const role = String(form.get("role")) === "admin" ? "admin" : "user";
    if (!email || !name)
      return fail(400, { action: "createUser", message: "Email and name are required." });
    if (password.length < 8)
      return fail(400, {
        action: "createUser",
        message: "Password must be at least 8 characters.",
      });
    try {
      await auth.api.createUser({
        body: { email, name, password, role },
        headers: request.headers,
      });
    } catch (e) {
      return fail(400, { action: "createUser", message: errMessage(e) });
    }
    return { action: "createUser", success: true, message: `Created ${email}.` };
  },

  setPassword: async ({ request, locals }) => {
    requireAdmin(locals);
    const form = await request.formData();
    const userId = String(form.get("userId"));
    const newPassword = String(form.get("newPassword"));
    if (newPassword.length < 8)
      return fail(400, {
        action: "setPassword",
        message: "Password must be at least 8 characters.",
      });
    try {
      await auth.api.setUserPassword({
        body: { userId, newPassword },
        headers: request.headers,
      });
    } catch (e) {
      return fail(400, { action: "setPassword", message: errMessage(e) });
    }
    return { action: "setPassword", success: true, message: "Password updated." };
  },

  ban: async ({ request, locals }) => {
    requireAdmin(locals);
    const form = await request.formData();
    const userId = String(form.get("userId"));
    // Don't let an admin ban themselves out of the dashboard.
    if (userId === locals.user!.id) {
      return fail(400, { action: "ban", message: "You can't ban yourself." });
    }
    const banReason = String(form.get("banReason") ?? "").trim() || "Banned by admin";
    const days = Number(form.get("banDays"));
    const body: { userId: string; banReason: string; banExpiresIn?: number } = {
      userId,
      banReason,
    };
    // banExpiresIn is in seconds; empty/0 means a permanent ban.
    if (days > 0) body.banExpiresIn = Math.round(days * 24 * 60 * 60);
    try {
      await auth.api.banUser({ body, headers: request.headers });
    } catch (e) {
      return fail(400, { action: "ban", message: errMessage(e) });
    }
    return { action: "ban", success: true, message: "User banned." };
  },

  unban: async ({ request, locals }) => {
    requireAdmin(locals);
    const form = await request.formData();
    const userId = String(form.get("userId"));
    try {
      await auth.api.unbanUser({ body: { userId }, headers: request.headers });
    } catch (e) {
      return fail(400, { action: "unban", message: errMessage(e) });
    }
    return { action: "unban", success: true, message: "User unbanned." };
  },

  revokeSessions: async ({ request, locals }) => {
    requireAdmin(locals);
    const form = await request.formData();
    const userId = String(form.get("userId"));
    try {
      await auth.api.revokeUserSessions({
        body: { userId },
        headers: request.headers,
      });
    } catch (e) {
      return fail(400, { action: "revokeSessions", message: errMessage(e) });
    }
    return { action: "revokeSessions", success: true, message: "All sessions revoked." };
  },

  remove: async ({ request, locals }) => {
    requireAdmin(locals);
    const form = await request.formData();
    const userId = String(form.get("userId"));
    if (userId === locals.user!.id) {
      return fail(400, { action: "remove", message: "You can't delete yourself." });
    }
    try {
      await auth.api.removeUser({ body: { userId }, headers: request.headers });
    } catch (e) {
      return fail(400, { action: "remove", message: errMessage(e) });
    }
    return { action: "remove", success: true, message: "User deleted." };
  },
};
