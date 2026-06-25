import { redirect, fail } from "@sveltejs/kit";
import { eq, desc, asc } from "drizzle-orm";
import { db } from "$lib/server/db";
import { client, glassType, orders, orderItem } from "$lib/server/db/schema";
import type { Actions, PageServerLoad } from "./$types";

const STATUSES = ["pending", "confirmed", "shipped", "cancelled"] as const;

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) throw redirect(302, "/login");
  if (locals.user.role !== "admin") throw redirect(302, "/dashboard");

  // Each order with its client and its line-items (each item with its glass type).
  const orderList = await db.query.orders.findMany({
    with: {
      client: true,
      items: { with: { glassType: true } },
    },
    orderBy: [desc(orders.createdAt)],
  });

  // For the "new order" and "add item" dropdowns.
  const clients = await db.select().from(client).orderBy(asc(client.name));
  const glassTypes = await db.select().from(glassType).orderBy(asc(glassType.name));

  return { orders: orderList, clients, glassTypes, statuses: STATUSES };
};

function requireAdmin(locals: App.Locals) {
  if (!locals.user || locals.user.role !== "admin") throw redirect(302, "/dashboard");
}

export const actions: Actions = {
  create: async ({ request, locals }) => {
    requireAdmin(locals);
    const form = await request.formData();
    const clientId = Number(form.get("clientId"));
    if (!clientId) return fail(400, { message: "Pick a client for the order." });
    const notes = String(form.get("notes") ?? "").trim();
    await db.insert(orders).values({ clientId, notes: notes || null });
    return { success: true, message: "Order created." };
  },

  setStatus: async ({ request, locals }) => {
    requireAdmin(locals);
    const form = await request.formData();
    const id = Number(form.get("id"));
    const status = String(form.get("status"));
    if (!id || !STATUSES.includes(status as (typeof STATUSES)[number])) {
      return fail(400, { message: "Invalid status." });
    }
    await db.update(orders).set({ status, updatedAt: new Date() }).where(eq(orders.id, id));
    return { success: true, message: "Status updated." };
  },

  addItem: async ({ request, locals }) => {
    requireAdmin(locals);
    const form = await request.formData();
    const orderId = Number(form.get("orderId"));
    const glassTypeId = Number(form.get("glassTypeId"));
    const quantity = Number(form.get("quantity"));
    if (!orderId || !glassTypeId) return fail(400, { message: "Pick a glass type." });
    if (!Number.isFinite(quantity) || quantity < 1) {
      return fail(400, { message: "Quantity must be at least 1." });
    }
    await db.insert(orderItem).values({ orderId, glassTypeId, quantity });
    await db.update(orders).set({ updatedAt: new Date() }).where(eq(orders.id, orderId));
    return { success: true, message: "Item added." };
  },

  removeItem: async ({ request, locals }) => {
    requireAdmin(locals);
    const form = await request.formData();
    const id = Number(form.get("id"));
    if (!id) return fail(400, { message: "Invalid item." });
    await db.delete(orderItem).where(eq(orderItem.id, id));
    return { success: true, message: "Item removed." };
  },

  remove: async ({ request, locals }) => {
    requireAdmin(locals);
    const form = await request.formData();
    const id = Number(form.get("id"));
    if (!id) return fail(400, { message: "Invalid order." });
    // Remove items first — SQLite foreign keys aren't enforced by default, so
    // don't rely on ON DELETE CASCADE to clean them up.
    await db.delete(orderItem).where(eq(orderItem.orderId, id));
    await db.delete(orders).where(eq(orders.id, id));
    return { success: true, message: "Order deleted." };
  },
};
