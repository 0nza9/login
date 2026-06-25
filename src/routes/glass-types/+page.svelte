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

  let editingId = $state<number | null>(null);

  const handle = (close = false): SubmitFunction => () =>
    async ({ result, update }) => {
      await update({ reset: false });
      await invalidateAll();
      if (close && result.type === "success") editingId = null;
    };

  // Show a number or an em-dash for nulls.
  const show = (n: number | null) => (n === null || n === undefined ? "—" : n);
</script>

<div class="min-h-screen bg-base-200 p-6">
  <div class="mx-auto max-w-5xl">
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-semibold">Glass types</h1>
        <p class="text-sm text-base-content/60">
          {data.types.length} type{data.types.length === 1 ? "" : "s"}
        </p>
      </div>
      <div class="flex gap-2">
        <a href="/orders" class="btn btn-sm btn-ghost">Orders</a>
        <a href="/dashboard" class="btn btn-sm btn-ghost">← Dashboard</a>
      </div>
    </div>

    <!-- Add glass type -->
    <div class="card mb-4 bg-base-100 shadow">
      <div class="card-body">
        <h2 class="card-title text-base">Add a glass type</h2>
        <form
          method="POST"
          action="?/create"
          use:enhance={handle()}
          class="grid grid-cols-2 gap-2 lg:grid-cols-6"
        >
          <input name="name" placeholder="Name *" required class="input input-sm input-bordered lg:col-span-2" />
          <input name="thickness" type="number" step="0.1" placeholder="Thickness (mm)" class="input input-sm input-bordered" />
          <input name="price" type="number" step="0.01" placeholder="Price" class="input input-sm input-bordered" />
          <input name="reflection" type="number" step="0.1" placeholder="Reflection %" class="input input-sm input-bordered" />
          <button class="btn btn-sm btn-primary" type="submit">Add</button>
          <input name="description" placeholder="Description" class="input input-sm input-bordered col-span-2 lg:col-span-6" />
        </form>
      </div>
    </div>

    <!-- Catalog -->
    <div class="card bg-base-100 shadow-xl">
      <div class="card-body">
        <div class="overflow-x-auto">
          <table class="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Thickness (mm)</th>
                <th>Price</th>
                <th>Reflection %</th>
                <th>Description</th>
                <th class="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {#each data.types as t (t.id)}
                {#if editingId === t.id}
                  <tr>
                    <td colspan="6">
                      <form
                        method="POST"
                        action="?/update"
                        use:enhance={handle(true)}
                        class="grid grid-cols-2 gap-2 lg:grid-cols-6"
                      >
                        <input type="hidden" name="id" value={t.id} />
                        <input name="name" value={t.name} required class="input input-sm input-bordered lg:col-span-2" />
                        <input name="thickness" type="number" step="0.1" value={t.thickness ?? ""} placeholder="Thickness" class="input input-sm input-bordered" />
                        <input name="price" type="number" step="0.01" value={t.price ?? ""} placeholder="Price" class="input input-sm input-bordered" />
                        <input name="reflection" type="number" step="0.1" value={t.reflection ?? ""} placeholder="Reflection %" class="input input-sm input-bordered" />
                        <div class="flex gap-1">
                          <button class="btn btn-sm btn-primary" type="submit">Save</button>
                          <button class="btn btn-sm btn-ghost" type="button" onclick={() => (editingId = null)}>Cancel</button>
                        </div>
                        <input name="description" value={t.description ?? ""} placeholder="Description" class="input input-sm input-bordered col-span-2 lg:col-span-6" />
                      </form>
                    </td>
                  </tr>
                {:else}
                  <tr>
                    <td class="font-medium">{t.name}</td>
                    <td>{show(t.thickness)}</td>
                    <td>{show(t.price)}</td>
                    <td>{show(t.reflection)}</td>
                    <td class="text-sm text-base-content/70">{t.description ?? "—"}</td>
                    <td class="text-right">
                      <div class="flex justify-end gap-1">
                        <button class="btn btn-sm btn-ghost" onclick={() => (editingId = t.id)}>Edit</button>
                        <form method="POST" action="?/remove" use:enhance={handle()}>
                          <input type="hidden" name="id" value={t.id} />
                          <button
                            class="btn btn-sm btn-ghost text-error"
                            onclick={(e) => {
                              if (!confirm(`Delete ${t.name}?`)) e.preventDefault();
                            }}
                          >
                            Delete
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                {/if}
              {:else}
                <tr>
                  <td colspan="6" class="text-center text-base-content/50">
                    No glass types yet — add one above.
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>

  {#if toast}
    <div class="toast toast-end">
      <div class="alert {toast.ok ? 'alert-success' : 'alert-error'}">
        <span>{toast.text}</span>
      </div>
    </div>
  {/if}
</div>
