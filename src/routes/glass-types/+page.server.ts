import { redirect, fail } from "@sveltejs/kit";
import { eq, desc } from "drizzle-orm";
import { db } from "$lib/server/db";
import { glassType } from "$lib/server/db/schema";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) throw redirect(302, "/login");
  if (locals.user.role !== "admin") throw redirect(302, "/dashboard");

  const types = await db.select().from(glassType).orderBy(desc(glassType.createdAt));
  return { types };
};

function requireAdmin(locals: App.Locals) {
  if (!locals.user || locals.user.role !== "admin") throw redirect(302, "/dashboard");
}

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

// Parse an optional numeric field — empty becomes null, invalid is rejected upstream.
function num(form: FormData, key: string): number | null {
  const v = str(form, key);
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export const actions: Actions = {
  create: async ({ request, locals }) => {
    requireAdmin(locals);
    const form = await request.formData();
    const name = str(form, "name");
    if (!name) return fail(400, { message: "Name is required." });
    try {
      await db.insert(glassType).values({
        name,
        description: str(form, "description") || null,
        thickness: num(form, "thickness"),
        price: num(form, "price"),
        reflection: num(form, "reflection"),
      });
    } catch {
      return fail(400, { message: "Could not add — that name may already exist." });
    }
    return { success: true, message: "Glass type added." };
  },

  update: async ({ request, locals }) => {
    requireAdmin(locals);
    const form = await request.formData();
    const id = Number(form.get("id"));
    const name = str(form, "name");
    if (!id || !name) return fail(400, { message: "Name is required." });
    try {
      await db
        .update(glassType)
        .set({
          name,
          description: str(form, "description") || null,
          thickness: num(form, "thickness"),
          price: num(form, "price"),
          reflection: num(form, "reflection"),
        })
        .where(eq(glassType.id, id));
    } catch {
      return fail(400, { message: "Could not save — that name may already exist." });
    }
    return { success: true, message: "Glass type updated." };
  },

  remove: async ({ request, locals }) => {
    requireAdmin(locals);
    const form = await request.formData();
    const id = Number(form.get("id"));
    if (!id) return fail(400, { message: "Invalid glass type." });
    await db.delete(glassType).where(eq(glassType.id, id));
    return { success: true, message: "Glass type deleted." };
  },
};
