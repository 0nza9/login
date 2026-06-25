<script lang="ts">
  import { enhance } from "$app/forms";
  import { invalidateAll } from "$app/navigation";
  import type { SubmitFunction } from "@sveltejs/kit";
  import type { PageData, ActionData } from "./$types";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let toast = $state<{ text: string; ok: boolean } | null>(null);
  let toastTimer: ReturnType<typeof setTimeout>;
  $effect(() => {
    if (form?.message) {
      toast = { text: form.message, ok: !!form.success };
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => (toast = null), 3000);
    }
  });

  const handle = (): SubmitFunction => () =>
    async ({ update }) => {
      await update({ reset: false });
      await invalidateAll();
    };

  // Line total = quantity × unit price (price may be unset).
  const lineTotal = (qty: number, price: number | null) => (price ?? 0) * qty;
  const orderTotal = (items: PageData["orders"][number]["items"]) =>
    items.reduce((sum, i) => sum + lineTotal(i.quantity, i.glassType?.price ?? null), 0);

  const fmt = (n: number) => n.toFixed(2);

  const statusColor: Record<string, string> = {
    pending: "badge-warning",
    confirmed: "badge-info",
    shipped: "badge-success",
    cancelled: "badge-error",
  };
</script>

<div class="min-h-screen bg-base-200 p-6">
  <div class="mx-auto max-w-5xl">
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-semibold">Orders</h1>
        <p class="text-sm text-base-content/60">
          {data.orders.length} order{data.orders.length === 1 ? "" : "s"}
        </p>
      </div>
      <div class="flex gap-2">
        <a href="/glass-types" class="btn btn-sm btn-ghost">Glass types</a>
        <a href="/dashboard" class="btn btn-sm btn-ghost">← Dashboard</a>
      </div>
    </div>

    <!-- New order -->
    <div class="card mb-4 bg-base-100 shadow">
      <div class="card-body">
        <h2 class="card-title text-base">New order</h2>
        {#if data.clients.length === 0}
          <p class="text-sm text-base-content/60">
            Add a <a href="/clients" class="link">client</a> first.
          </p>
        {:else}
          <form
            method="POST"
            action="?/create"
            use:enhance={handle()}
            class="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_2fr_auto]"
          >
            <select name="clientId" required class="select select-sm select-bordered">
              <option value="" disabled selected>Choose a client…</option>
              {#each data.clients as c (c.id)}
                <option value={c.id}>{c.name}{c.company ? ` · ${c.company}` : ""}</option>
              {/each}
            </select>
            <input name="notes" placeholder="Notes (optional)" class="input input-sm input-bordered" />
            <button class="btn btn-sm btn-primary" type="submit">Create order</button>
          </form>
        {/if}
      </div>
    </div>

    <!-- Orders -->
    {#each data.orders as o (o.id)}
      <div class="card mb-4 bg-base-100 shadow-xl">
        <div class="card-body">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 class="text-lg font-semibold">
                Order #{o.id} · {o.client?.name ?? "—"}
              </h3>
              {#if o.notes}<p class="text-sm text-base-content/60">{o.notes}</p>{/if}
            </div>
            <div class="flex items-center gap-2">
              <span class="badge {statusColor[o.status] ?? 'badge-ghost'}">{o.status}</span>
              <!-- Change status -->
              <form method="POST" action="?/setStatus" use:enhance={handle()}>
                <input type="hidden" name="id" value={o.id} />
                <select
                  name="status"
                  class="select select-xs select-bordered"
                  value={o.status}
                  onchange={(e) => e.currentTarget.form?.requestSubmit()}
                >
                  {#each data.statuses as s (s)}
                    <option value={s}>{s}</option>
                  {/each}
                </select>
              </form>
              <!-- Delete order -->
              <form method="POST" action="?/remove" use:enhance={handle()}>
                <input type="hidden" name="id" value={o.id} />
                <button
                  class="btn btn-xs btn-ghost text-error"
                  onclick={(e) => {
                    if (!confirm(`Delete order #${o.id}?`)) e.preventDefault();
                  }}
                >
                  Delete
                </button>
              </form>
            </div>
          </div>

          <!-- Items -->
          <div class="mt-2 overflow-x-auto">
            <table class="table table-sm">
              <thead>
                <tr>
                  <th>Glass type</th>
                  <th class="text-right">Unit price</th>
                  <th class="text-right">Qty</th>
                  <th class="text-right">Line total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {#each o.items as it (it.id)}
                  <tr>
                    <td>{it.glassType?.name ?? "—"}</td>
                    <td class="text-right">{it.glassType?.price != null ? fmt(it.glassType.price) : "—"}</td>
                    <td class="text-right">{it.quantity}</td>
                    <td class="text-right">{fmt(lineTotal(it.quantity, it.glassType?.price ?? null))}</td>
                    <td class="text-right">
                      <form method="POST" action="?/removeItem" use:enhance={handle()}>
                        <input type="hidden" name="id" value={it.id} />
                        <button class="btn btn-xs btn-ghost text-error" type="submit">✕</button>
                      </form>
                    </td>
                  </tr>
                {:else}
                  <tr><td colspan="5" class="text-base-content/50">No items yet.</td></tr>
                {/each}
              </tbody>
              {#if o.items.length}
                <tfoot>
                  <tr>
                    <th colspan="3" class="text-right">Total</th>
                    <th class="text-right">{fmt(orderTotal(o.items))}</th>
                    <th></th>
                  </tr>
                </tfoot>
              {/if}
            </table>
          </div>

          <!-- Add item -->
          {#if data.glassTypes.length === 0}
            <p class="text-sm text-base-content/60">
              Add a <a href="/glass-types" class="link">glass type</a> to start filling orders.
            </p>
          {:else}
            <form
              method="POST"
              action="?/addItem"
              use:enhance={handle()}
              class="mt-1 flex flex-wrap items-center gap-2"
            >
              <input type="hidden" name="orderId" value={o.id} />
              <select name="glassTypeId" required class="select select-sm select-bordered">
                <option value="" disabled selected>Add glass type…</option>
                {#each data.glassTypes as g (g.id)}
                  <option value={g.id}>{g.name}{g.price != null ? ` · ${fmt(g.price)}` : ""}</option>
                {/each}
              </select>
              <input
                name="quantity"
                type="number"
                min="1"
                value="1"
                class="input input-sm input-bordered w-20"
              />
              <button class="btn btn-sm btn-outline" type="submit">Add item</button>
            </form>
          {/if}
        </div>
      </div>
    {:else}
      <div class="card bg-base-100 shadow-xl">
        <div class="card-body text-center text-base-content/50">
          No orders yet — create one above.
        </div>
      </div>
    {/each}
  </div>

  {#if toast}
    <div class="toast toast-end">
      <div class="alert {toast.ok ? 'alert-success' : 'alert-error'}">
        <span>{toast.text}</span>
      </div>
    </div>
  {/if}
</div>
