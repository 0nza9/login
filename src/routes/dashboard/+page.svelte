<script lang="ts">
  import { untrack } from "svelte";
  import { enhance } from "$app/forms";
  import { goto, invalidateAll } from "$app/navigation";
  import { authClient } from "$lib/auth-client";
  import type { PageData } from "./$types";
  import type { SubmitFunction } from "@sveltejs/kit";

  let { data }: { data: PageData } = $props();

  // --- Toast feedback -------------------------------------------------------
  type Toast = { id: number; type: "success" | "error"; msg: string };
  let toasts = $state<Toast[]>([]);
  let nextId = 0;

  function notify(type: Toast["type"], msg: string) {
    const id = nextId++;
    toasts.push({ id, type, msg });
    setTimeout(() => {
      toasts = toasts.filter((t) => t.id !== id);
    }, 3500);
  }

  // True while any mutation is in flight — used to disable controls so an
  // admin can't fire overlapping edits before the table refreshes.
  let busy = $state(false);

  // Shared enhance handler: surfaces server success/failure as a toast,
  // keeps the form's typed value (reset: false), and refreshes the table.
  function action(successMsg: string): SubmitFunction {
    return () => {
      busy = true;
      return async ({ result, update }) => {
        await update({ reset: false });
        if (result.type === "success") notify("success", successMsg);
        else if (result.type === "failure")
          notify("error", String(result.data?.message ?? "Something went wrong."));
        else if (result.type === "error") notify("error", "Request failed.");
        await invalidateAll();
        busy = false;
      };
    };
  }

  async function logout() {
    await authClient.signOut();
    await goto("/login");
  }

  // --- Self-service account (every user can edit their own profile) ---------
  // Seed once from the loaded profile; the field is independently editable after.
  let name = $state(untrack(() => data.me.name));
  let savingName = $state(false);
  async function saveName(e: SubmitEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return notify("error", "Name can't be empty.");
    savingName = true;
    const { error } = await authClient.updateUser({ name: trimmed });
    savingName = false;
    if (error) return notify("error", error.message ?? "Could not update name.");
    notify("success", "Name updated.");
    await invalidateAll();
  }

  let currentPassword = $state("");
  let newPassword = $state("");
  let confirmPassword = $state("");
  let savingPw = $state(false);
  async function savePassword(e: SubmitEvent) {
    e.preventDefault();
    if (newPassword.length < 8)
      return notify("error", "New password must be at least 8 characters.");
    if (newPassword !== confirmPassword) return notify("error", "Passwords don't match.");
    savingPw = true;
    // revokeOtherSessions signs out this account everywhere else after a change.
    const { error } = await authClient.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: true,
    });
    savingPw = false;
    if (error) return notify("error", error.message ?? "Could not change password.");
    notify("success", "Password changed.");
    currentPassword = newPassword = confirmPassword = "";
  }
</script>

<div class="min-h-screen bg-base-200 p-6">
  <div class="mx-auto max-w-5xl">
    <!-- Header -->
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-semibold">Dashboard</h1>
        <p class="text-sm text-base-content/60">
          {data.me.name} · {data.me.email}
          <span class="badge badge-sm ml-1" class:badge-primary={data.isAdmin}>
            {data.me.role ?? "user"}
          </span>
        </p>
      </div>
      <div class="flex items-center gap-2">
        {#if busy}
          <span class="loading loading-spinner loading-sm text-primary"></span>
        {/if}
        <a href="/" class="btn btn-sm btn-ghost">← Back</a>
        {#if data.isAdmin}
          <a href="/clients" class="btn btn-sm btn-outline">Clients</a>
        {/if}
        <button class="btn btn-sm btn-outline" onclick={logout}>Sign out</button>
      </div>
    </div>

    <!-- Your account — self-service profile for every signed-in user -->
    <div class="card mb-6 bg-base-100 shadow-xl">
      <div class="card-body">
        <h2 class="card-title">Your account</h2>
        <p class="text-sm text-base-content/60">
          Manage your own profile. {data.me.email} · {data.me.role ?? "user"}
        </p>

        <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
          <!-- Edit name -->
          <form class="flex flex-col gap-2" onsubmit={saveName}>
            <label class="text-sm font-medium" for="acct-name">Display name</label>
            <input
              id="acct-name"
              bind:value={name}
              class="input input-sm input-bordered"
              autocomplete="name"
            />
            <button class="btn btn-sm btn-primary self-start" type="submit" disabled={savingName}>
              {savingName ? "Saving…" : "Save name"}
            </button>
          </form>

          <!-- Change password -->
          <form class="flex flex-col gap-2" onsubmit={savePassword}>
            <label class="text-sm font-medium" for="acct-cpw">Change password</label>
            <input
              id="acct-cpw"
              bind:value={currentPassword}
              type="password"
              placeholder="Current password"
              class="input input-sm input-bordered"
              autocomplete="current-password"
            />
            <input
              bind:value={newPassword}
              type="password"
              placeholder="New password (min 8 chars)"
              class="input input-sm input-bordered"
              autocomplete="new-password"
            />
            <input
              bind:value={confirmPassword}
              type="password"
              placeholder="Confirm new password"
              class="input input-sm input-bordered"
              autocomplete="new-password"
            />
            <button class="btn btn-sm btn-primary self-start" type="submit" disabled={savingPw}>
              {savingPw ? "Saving…" : "Change password"}
            </button>
          </form>
        </div>
      </div>
    </div>

    {#if data.isAdmin}
      <div class="card bg-base-100 shadow-xl">
        <div class="card-body">
          <h2 class="card-title">Users</h2>
          <p class="text-sm text-base-content/60">
            Only admins can see and edit this. Changes are enforced server-side.
          </p>

          <div class="overflow-x-auto">
            <table class="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th class="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {#each data.users as u (u.id)}
                  {@const isMe = u.id === data.me.id}
                  <tr>
                    <!-- Edit name -->
                    <td>
                      <form
                        method="POST"
                        action="?/updateName"
                        class="flex gap-1"
                        use:enhance={action("Name updated.")}
                      >
                        <input type="hidden" name="userId" value={u.id} />
                        <input
                          name="name"
                          value={u.name}
                          required
                          class="input input-sm input-bordered w-36"
                          disabled={busy}
                        />
                        <button class="btn btn-sm btn-ghost" type="submit" disabled={busy}>
                          Save
                        </button>
                      </form>
                    </td>

                    <td class="text-sm">{u.email}</td>

                    <!-- Change role -->
                    <td>
                      <form method="POST" action="?/setRole" use:enhance={action("Role changed.")}>
                        <input type="hidden" name="userId" value={u.id} />
                        <select
                          name="role"
                          class="select select-sm select-bordered"
                          value={u.role ?? "user"}
                          onchange={(e) => e.currentTarget.form?.requestSubmit()}
                          disabled={isMe || busy}
                          title={isMe ? "You can't change your own role" : ""}
                        >
                          <option value="user">user</option>
                          <option value="admin">admin</option>
                        </select>
                      </form>
                    </td>

                    <!-- Ban status -->
                    <td>
                      {#if u.banned}
                        <span class="badge badge-error badge-sm">banned</span>
                      {:else}
                        <span class="badge badge-ghost badge-sm">active</span>
                      {/if}
                    </td>

                    <!-- Ban / unban / delete -->
                    <td class="text-right">
                      {#if !isMe}
                        <div class="flex justify-end gap-1">
                          {#if u.banned}
                            <form
                              method="POST"
                              action="?/unban"
                              use:enhance={action("User unbanned.")}
                            >
                              <input type="hidden" name="userId" value={u.id} />
                              <button class="btn btn-sm btn-ghost" disabled={busy}>Unban</button>
                            </form>
                          {:else}
                            <form method="POST" action="?/ban" use:enhance={action("User banned.")}>
                              <input type="hidden" name="userId" value={u.id} />
                              <button class="btn btn-sm btn-ghost text-warning" disabled={busy}>
                                Ban
                              </button>
                            </form>
                          {/if}
                          <form method="POST" action="?/remove" use:enhance={action("User deleted.")}>
                            <input type="hidden" name="userId" value={u.id} />
                            <button
                              class="btn btn-sm btn-ghost text-error"
                              disabled={busy}
                              onclick={(e) => {
                                if (!confirm(`Delete ${u.name}? This can't be undone.`))
                                  e.preventDefault();
                              }}
                            >
                              Delete
                            </button>
                          </form>
                        </div>
                      {:else}
                        <span class="text-xs text-base-content/40">that's you</span>
                      {/if}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    {/if}
  </div>

  <!-- Toast feedback for every admin action -->
  <div class="toast toast-end z-50">
    {#each toasts as t (t.id)}
      <div class="alert {t.type === 'success' ? 'alert-success' : 'alert-error'} text-sm shadow-lg">
        <span>{t.msg}</span>
      </div>
    {/each}
  </div>
</div>
