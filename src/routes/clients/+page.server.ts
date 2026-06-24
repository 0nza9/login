import { redirect, fail } from "@sveltejs/kit";
import { or, like, desc, eq } from "drizzle-orm";
import { db } from "$lib/server/db";
import { client } from "$lib/server/db/schema";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, url }) => {
  // Signed-in admins only. Logged-out → login; signed-in non-admins → dashboard.
  if (!locals.user) throw redirect(302, "/login");
  if (locals.user.role !== "admin") throw redirect(302, "/dashboard");

  const q = (url.searchParams.get("q") ?? "").trim();

  // Search across name / email / company / phone when a query is present.
  const rows = await db
    .select()
    .from(client)
    .where(
      q
        ? or(
            like(client.name, `%${q}%`),
            like(client.email, `%${q}%`),
            like(client.company, `%${q}%`),
            like(client.phone, `%${q}%`),
          )
        : undefined,
    )
    .orderBy(desc(client.createdAt));

  return { clients: rows, q };
};

// Every action re-checks admin server-side — the hidden UI is not the boundary.
function requireAdmin(locals: App.Locals) {
  if (!locals.user || locals.user.role !== "admin") throw redirect(302, "/dashboard");
}

// Read + trim a form field, returning null for empty optional fields.
function field(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

export const actions: Actions = {
  create: async ({ request, locals }) => {
    requireAdmin(locals);
    const form = await request.formData();
    const name = field(form, "name");
    const email = field(form, "email");
    if (!name || !email) {
      return fail(400, { message: "Name and email are required." });
    }
    try {
      await db.insert(client).values({
        name,
        email,
        phone: field(form, "phone") || null,
        company: field(form, "company") || null,
        notes: field(form, "notes") || null,
      });
    } catch {
      // The most likely failure is the unique email constraint.
      return fail(400, { message: "Could not add client — that email may already exist." });
    }
    return { success: true, message: "Client added." };
  },

  update: async ({ request, locals }) => {
    requireAdmin(locals);
    const form = await request.formData();
    const id = Number(form.get("id"));
    const name = field(form, "name");
    const email = field(form, "email");
    if (!id || !name || !email) {
      return fail(400, { message: "Name and email are required." });
    }
    try {
      await db
        .update(client)
        .set({
          name,
          email,
          phone: field(form, "phone") || null,
          company: field(form, "company") || null,
          notes: field(form, "notes") || null,
          updatedAt: new Date(),
        })
        .where(eq(client.id, id));
    } catch {
      return fail(400, { message: "Could not save — that email may already exist." });
    }
    return { success: true, message: "Client updated." };
  },

  remove: async ({ request, locals }) => {
    requireAdmin(locals);
    const form = await request.formData();
    const id = Number(form.get("id"));
    if (!id) return fail(400, { message: "Invalid client." });
    await db.delete(client).where(eq(client.id, id));
    return { success: true, message: "Client deleted." };
  },
};
