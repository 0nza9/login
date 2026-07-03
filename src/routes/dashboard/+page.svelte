<script lang="ts">
  import { untrack } from "svelte";
  import { enhance } from "$app/forms";
  import { goto, invalidateAll } from "$app/navigation";
  import { authClient } from "$lib/auth-client";
  import type { PageData } from "./$types";
  import type { SubmitFunction } from "@sveltejs/kit";

  let { data }: { data: PageData } = $props();

  let createDialog = $state<HTMLDialogElement>();

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

  // Shared enhance handler: surfaces server success/failure as a toast, keeps
  // the form's typed value (reset: false by default), refreshes the table, and
  // optionally runs onSuccess (e.g. close a modal/drawer).
  function action(
    successMsg: string,
    opts: { reset?: boolean; onSuccess?: () => void } = {},
  ): SubmitFunction {
    return () => {
      busy = true;
      return async ({ result, update }) => {
        await update({ reset: opts.reset ?? false });
        if (result.type === "success") {
          notify("success", successMsg);
          opts.onSuccess?.();
        } else if (result.type === "failure")
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

  // --- URL helpers (preserve search/page while toggling drawer/paging) -----
  function buildUrl(overrides: Record<string, string | number | null>) {
    const p = new URLSearchParams();
    if (data.q) p.set("q", data.q);
    if (data.field !== "email") p.set("field", data.field);
    if (data.page > 1) p.set("page", String(data.page));
    for (const [k, v] of Object.entries(overrides)) {
      if (v === null || v === "") p.delete(k);
      else p.set(k, String(v));
    }
    const s = p.toString();
    return s ? `/dashboard?${s}` : "/dashboard";
  }
  const openManage = (id: string) => goto(buildUrl({ manage: id }));
  const closeManage = () => goto(buildUrl({ manage: null }));

  // --- Impersonation (client-side so the session cookie swaps correctly) ---
  async function impersonate(userId: string) {
    const { error } = await authClient.admin.impersonateUser({ userId });
    if (error) return notify("error", error.message ?? "Could not impersonate.");
    await goto("/dashboard");
    await invalidateAll();
  }
  async function stopImpersonating() {
    await authClient.admin.stopImpersonating();
    await goto("/dashboard");
    await invalidateAll();
  }

  // --- Pagination derived state -------------------------------------------
  const totalPages = $derived(Math.max(1, Math.ceil(data.total / data.pageSize)));
  const rangeStart = $derived(data.total === 0 ? 0 : (data.page - 1) * data.pageSize + 1);
  const rangeEnd = $derived(Math.min(data.page * data.pageSize, data.total));

  function fmtDate(d: string | number | Date | null | undefined) {
    if (!d) return "—";
    const date = new Date(d);
    return isNaN(date.getTime()) ? "—" : date.toLocaleString();
  }
</script>

<div class="min-h-screen bg-base-200 p-6">
  <div class="mx-auto max-w-5xl">
    <!-- Impersonation banner -->
    {#if data.impersonating}
      <div class="alert alert-warning mb-4">
        <span>You are impersonating <strong>{data.me.name}</strong> ({data.me.email}).</span>
        <button class="btn btn-sm" onclick={stopImpersonating}>Stop impersonating</button>
      </div>
    {/if}

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
          <a href="/glass-types" class="btn btn-sm btn-outline">Glass types</a>
          <a href="/orders" class="btn btn-sm btn-outline">Orders</a>
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
      <!-- Stats -->
      {#if data.stats}
        <div class="stats mb-6 w-full shadow">
          <div class="stat">
            <div class="stat-title">Total users</div>
            <div class="stat-value text-primary">{data.stats.total}</div>
          </div>
          <div class="stat">
            <div class="stat-title">Admins</div>
            <div class="stat-value">{data.stats.admins}</div>
          </div>
          <div class="stat">
            <div class="stat-title">Banned</div>
            <div class="stat-value text-error">{data.stats.banned}</div>
          </div>
        </div>
      {/if}

      <div class="card bg-base-100 shadow-xl">
        <div class="card-body">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h2 class="card-title">Users</h2>
            <button class="btn btn-sm btn-primary" onclick={() => createDialog?.showModal()}>
              + New user
            </button>
          </div>
          <p class="text-sm text-base-content/60">
            Only admins can see and edit this. Changes are enforced server-side.
          </p>

          <!-- Search -->
          <form method="GET" class="mt-2 flex flex-wrap gap-2">
            <input
              name="q"
              value={data.q}
              placeholder="Search…"
              class="input input-sm input-bordered w-56"
            />
            <select name="field" value={data.field} class="select select-sm select-bordered">
              <option value="email">Email</option>
              <option value="name">Name</option>
            </select>
            <button class="btn btn-sm" type="submit">Search</button>
            {#if data.q}
              <a href="/dashboard" class="btn btn-sm btn-ghost">Clear</a>
            {/if}
          </form>

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

                    <!-- Actions -->
                    <td class="text-right">
                      <div class="flex justify-end gap-1">
                        <button
                          class="btn btn-sm btn-ghost"
                          disabled={busy}
                          onclick={() => openManage(u.id)}
                        >
                          Manage
                        </button>
                        {#if !isMe}
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
                        {:else}
                          <span class="self-center text-xs text-base-content/40">that's you</span>
                        {/if}
                      </div>
                    </td>
                  </tr>
                {/each}
                {#if data.users.length === 0}
                  <tr>
                    <td colspan="5" class="text-center text-base-content/50">No users found.</td>
                  </tr>
                {/if}
              </tbody>
            </table>
          </div>

          <!-- Pagination -->
          <div class="mt-2 flex items-center justify-between">
            <span class="text-sm text-base-content/60">
              {rangeStart}–{rangeEnd} of {data.total}
            </span>
            <div class="join">
              <a
                class="btn btn-sm join-item"
                class:btn-disabled={data.page <= 1}
                href={buildUrl({ page: data.page - 1, manage: null })}
              >
                «
              </a>
              <span class="btn btn-sm join-item pointer-events-none">
                Page {data.page} / {totalPages}
              </span>
              <a
                class="btn btn-sm join-item"
                class:btn-disabled={data.page >= totalPages}
                href={buildUrl({ page: data.page + 1, manage: null })}
              >
                »
              </a>
            </div>
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

<!-- Create user modal -->
<dialog bind:this={createDialog} class="modal">
  <div class="modal-box">
    <h3 class="text-lg font-bold">Create user</h3>
    <form
      method="POST"
      action="?/createUser"
      class="mt-4 flex flex-col gap-3"
      use:enhance={action("User created.", { reset: true, onSuccess: () => createDialog?.close() })}
    >
      <input name="name" placeholder="Name" required class="input input-bordered w-full" />
      <input
        name="email"
        type="email"
        placeholder="email@example.com"
        required
        class="input input-bordered w-full"
      />
      <input
        name="password"
        type="password"
        placeholder="Password (min 8)"
        required
        minlength="8"
        class="input input-bordered w-full"
      />
      <select name="role" class="select select-bordered w-full">
        <option value="user">user</option>
        <option value="admin">admin</option>
      </select>
      <div class="modal-action">
        <button type="button" class="btn btn-ghost" onclick={() => createDialog?.close()}>
          Cancel
        </button>
        <button type="submit" class="btn btn-primary" disabled={busy}>Create</button>
      </div>
    </form>
  </div>
  <form method="dialog" class="modal-backdrop"><button>close</button></form>
</dialog>

<!-- Manage user drawer -->
{#if data.selectedUser}
  {@const su = data.selectedUser}
  {@const isMe = su.id === data.me.id}
  <div class="fixed inset-0 z-40 flex justify-end">
    <button class="absolute inset-0 bg-black/40" onclick={closeManage} aria-label="Close"></button>
    <div class="relative z-10 h-full w-full max-w-md overflow-y-auto bg-base-100 p-6 shadow-2xl">
      <div class="flex items-start justify-between">
        <div>
          <h3 class="text-lg font-bold">{su.name}</h3>
          <p class="text-sm text-base-content/60">{su.email}</p>
        </div>
        <button class="btn btn-sm btn-ghost" onclick={closeManage}>✕</button>
      </div>

      <!-- Impersonate -->
      <div class="divider">Session</div>
      <button
        class="btn btn-sm btn-outline w-full"
        disabled={isMe}
        onclick={() => impersonate(su.id)}
      >
        Login as this user
      </button>

      <!-- Active sessions -->
      <div class="mt-4">
        <div class="mb-1 flex items-center justify-between">
          <span class="text-sm font-medium">Active sessions ({data.sessions.length})</span>
          {#if data.sessions.length > 0}
            <form method="POST" action="?/revokeSessions" use:enhance={action("Sessions revoked.")}>
              <input type="hidden" name="userId" value={su.id} />
              <button class="btn btn-xs btn-ghost text-error" disabled={busy}>Revoke all</button>
            </form>
          {/if}
        </div>
        <ul class="space-y-1 text-xs text-base-content/60">
          {#each data.sessions as s (s.id)}
            <li class="rounded bg-base-200 p-2">
              <div>{s.ipAddress || "unknown IP"}</div>
              <div class="truncate">{s.userAgent || "unknown device"}</div>
              <div>expires {fmtDate(s.expiresAt)}</div>
            </li>
          {:else}
            <li>No active sessions.</li>
          {/each}
        </ul>
      </div>

      <!-- Set password -->
      <div class="divider">Password</div>
      <form
        method="POST"
        action="?/setPassword"
        class="flex gap-2"
        use:enhance={action("Password updated.", { reset: true })}
      >
        <input type="hidden" name="userId" value={su.id} />
        <input
          name="newPassword"
          type="password"
          placeholder="New password (min 8)"
          minlength="8"
          required
          class="input input-sm input-bordered flex-1"
        />
        <button class="btn btn-sm" disabled={busy}>Set</button>
      </form>

      <!-- Ban / unban -->
      <div class="divider">Access</div>
      {#if su.banned}
        <div class="flex items-center justify-between">
          <span class="badge badge-error">banned</span>
          <form method="POST" action="?/unban" use:enhance={action("User unbanned.")}>
            <input type="hidden" name="userId" value={su.id} />
            <button class="btn btn-sm" disabled={busy}>Unban</button>
          </form>
        </div>
        {#if su.banReason}<p class="mt-2 text-xs text-base-content/60">Reason: {su.banReason}</p>{/if}
        {#if su.banExpires}<p class="text-xs text-base-content/60">Until: {fmtDate(su.banExpires)}</p>{/if}
      {:else if isMe}
        <p class="text-sm text-base-content/50">You can't ban yourself.</p>
      {:else}
        <form
          method="POST"
          action="?/ban"
          class="flex flex-col gap-2"
          use:enhance={action("User banned.", { reset: true })}
        >
          <input type="hidden" name="userId" value={su.id} />
          <input
            name="banReason"
            placeholder="Reason (optional)"
            class="input input-sm input-bordered w-full"
          />
          <label class="flex items-center gap-2 text-sm">
            <span class="text-base-content/60">Expires in</span>
            <input
              name="banDays"
              type="number"
              min="0"
              placeholder="days (0 = permanent)"
              class="input input-sm input-bordered w-40"
            />
          </label>
          <button class="btn btn-sm btn-warning" disabled={busy}>Ban user</button>
        </form>
      {/if}

      <!-- Delete -->
      {#if !isMe}
        <div class="divider">Danger</div>
        <form
          method="POST"
          action="?/remove"
          use:enhance={action("User deleted.", { onSuccess: closeManage })}
        >
          <input type="hidden" name="userId" value={su.id} />
          <button
            class="btn btn-sm btn-error btn-outline w-full"
            disabled={busy}
            onclick={(e) => {
              if (!confirm("Delete this user permanently?")) e.preventDefault();
            }}
          >
            Delete user
          </button>
        </form>
      {/if}
    </div>
  </div>
{/if}
