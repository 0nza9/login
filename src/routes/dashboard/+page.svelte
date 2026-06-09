<script lang="ts">
  import { enhance } from "$app/forms";
  import { goto, invalidateAll } from "$app/navigation";
  import { authClient } from "$lib/auth-client";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  async function logout() {
    await authClient.signOut();
    await goto("/login");
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
      <div class="flex gap-2">
        <a href="/" class="btn btn-sm btn-ghost">← Back</a>
        <button class="btn btn-sm btn-outline" onclick={logout}>Sign out</button>
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
                        use:enhance={() => async ({ update }) => {
                          await update({ reset: false });
                          await invalidateAll();
                        }}
                      >
                        <input type="hidden" name="userId" value={u.id} />
                        <input
                          name="name"
                          value={u.name}
                          class="input input-sm input-bordered w-36"
                        />
                        <button class="btn btn-sm btn-ghost" type="submit">Save</button>
                      </form>
                    </td>

                    <td class="text-sm">{u.email}</td>

                    <!-- Change role -->
                    <td>
                      <form
                        method="POST"
                        action="?/setRole"
                        use:enhance={() => async ({ update }) => {
                          await update();
                          await invalidateAll();
                        }}
                      >
                        <input type="hidden" name="userId" value={u.id} />
                        <select
                          name="role"
                          class="select select-sm select-bordered"
                          value={u.role ?? "user"}
                          onchange={(e) => e.currentTarget.form?.requestSubmit()}
                          disabled={isMe}
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
                              use:enhance={() => async ({ update }) => {
                                await update();
                                await invalidateAll();
                              }}
                            >
                              <input type="hidden" name="userId" value={u.id} />
                              <button class="btn btn-sm btn-ghost">Unban</button>
                            </form>
                          {:else}
                            <form
                              method="POST"
                              action="?/ban"
                              use:enhance={() => async ({ update }) => {
                                await update();
                                await invalidateAll();
                              }}
                            >
                              <input type="hidden" name="userId" value={u.id} />
                              <button class="btn btn-sm btn-ghost text-warning">Ban</button>
                            </form>
                          {/if}
                          <form
                            method="POST"
                            action="?/remove"
                            use:enhance={() => async ({ update }) => {
                              await update();
                              await invalidateAll();
                            }}
                          >
                            <input type="hidden" name="userId" value={u.id} />
                            <button
                              class="btn btn-sm btn-ghost text-error"
                              onclick={(e) => {
                                if (!confirm("Delete this user?")) e.preventDefault();
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
    {:else}
      <div class="card bg-base-100 shadow-xl">
        <div class="card-body">
          <h2 class="card-title">Welcome</h2>
          <p class="text-base-content/70">
            You're signed in as a regular user. Only admins can manage users.
          </p>
        </div>
      </div>
    {/if}
  </div>
</div>
