<script lang="ts">
  import { enhance } from "$app/forms";
  import { invalidateAll } from "$app/navigation";
  import type { SubmitFunction } from "@sveltejs/kit";
  import type { PageData, ActionData } from "./$types";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  // Simple toast: show the server message briefly after an action.
  let toast = $state<{ text: string; ok: boolean } | null>(null);
  let toastTimer: ReturnType<typeof setTimeout>;
  $effect(() => {
    if (form?.message) {
      toast = { text: form.message, ok: !!form.success };
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => (toast = null), 3000);
    }
  });

  // Which row is in edit mode (null = none).
  let editingId = $state<number | null>(null);

  // Shared enhance handler: refresh data, then drop out of edit mode on success.
  const handle = (close = false): SubmitFunction => () =>
    async ({ result, update }) => {
      await update({ reset: false });
      await invalidateAll();
      if (close && result.type === "success") editingId = null;
    };
</script>

<div class="min-h-screen bg-base-200 p-6">
  <div class="mx-auto max-w-5xl">
    <!-- Header -->
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-semibold">Clients</h1>
        <p class="text-sm text-base-content/60">
          {data.clients.length} client{data.clients.length === 1 ? "" : "s"}
        </p>
      </div>
      <a href="/dashboard" class="btn btn-sm btn-ghost">← Dashboard</a>
    </div>

    <!-- Search bar -->
    <form method="GET" class="mb-4 flex gap-2">
      <input
        type="search"
        name="q"
        value={data.q}
        placeholder="Search name, email, company or phone…"
        class="input input-bordered w-full"
      />
      <button class="btn btn-primary" type="submit">Search</button>
      {#if data.q}
        <a href="/clients" class="btn btn-ghost">Clear</a>
      {/if}
    </form>

    <!-- Add client -->
    <div class="card mb-4 bg-base-100 shadow">
      <div class="card-body">
        <h2 class="card-title text-base">Add a client</h2>
        <form
          method="POST"
          action="?/create"
          use:enhance={handle()}
          class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5"
        >
          <input name="name" placeholder="Name *" required class="input input-sm input-bordered" />
          <input name="email" type="email" placeholder="Email *" required class="input input-sm input-bordered" />
          <input name="phone" placeholder="Phone" class="input input-sm input-bordered" />
          <input name="company" placeholder="Company" class="input input-sm input-bordered" />
          <button class="btn btn-sm btn-primary" type="submit">Add</button>
          <input name="notes" placeholder="Notes" class="input input-sm input-bordered sm:col-span-2 lg:col-span-5" />
        </form>
      </div>
    </div>

    <!-- Client list -->
    <div class="card bg-base-100 shadow-xl">
      <div class="card-body">
        <div class="overflow-x-auto">
          <table class="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Company</th>
                <th class="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {#each data.clients as c (c.id)}
                {#if editingId === c.id}
                  <!-- Edit row -->
                  <tr>
                    <td colspan="5">
                      <form
                        method="POST"
                        action="?/update"
                        use:enhance={handle(true)}
                        class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5"
                      >
                        <input type="hidden" name="id" value={c.id} />
                        <input name="name" value={c.name} required class="input input-sm input-bordered" />
                        <input name="email" type="email" value={c.email} required class="input input-sm input-bordered" />
                        <input name="phone" value={c.phone ?? ""} placeholder="Phone" class="input input-sm input-bordered" />
                        <input name="company" value={c.company ?? ""} placeholder="Company" class="input input-sm input-bordered" />
                        <div class="flex gap-1">
                          <button class="btn btn-sm btn-primary" type="submit">Save</button>
                          <button class="btn btn-sm btn-ghost" type="button" onclick={() => (editingId = null)}>
                            Cancel
                          </button>
                        </div>
                        <input name="notes" value={c.notes ?? ""} placeholder="Notes" class="input input-sm input-bordered sm:col-span-2 lg:col-span-5" />
                      </form>
                    </td>
                  </tr>
                {:else}
                  <!-- Display row -->
                  <tr>
                    <td class="font-medium">{c.name}</td>
                    <td class="text-sm">{c.email}</td>
                    <td class="text-sm">{c.phone ?? "—"}</td>
                    <td class="text-sm">{c.company ?? "—"}</td>
                    <td class="text-right">
                      <div class="flex justify-end gap-1">
                        <button class="btn btn-sm btn-ghost" onclick={() => (editingId = c.id)}>Edit</button>
                        <form method="POST" action="?/remove" use:enhance={handle()}>
                          <input type="hidden" name="id" value={c.id} />
                          <button
                            class="btn btn-sm btn-ghost text-error"
                            onclick={(e) => {
                              if (!confirm(`Delete ${c.name}?`)) e.preventDefault();
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
                  <td colspan="5" class="text-center text-base-content/50">
                    {data.q ? `No clients match “${data.q}”.` : "No clients yet — add one above."}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>

  <!-- Toast -->
  {#if toast}
    <div class="toast toast-end">
      <div class="alert {toast.ok ? 'alert-success' : 'alert-error'}">
        <span>{toast.text}</span>
      </div>
    </div>
  {/if}
</div>
