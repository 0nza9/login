<script lang="ts">
  import { authClient } from "$lib/auth-client";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";

  // better-auth puts the reset token in the query string. If the link was
  // invalid/expired it instead sends ?error=... back to this page.
  const token = $derived(page.url.searchParams.get("token"));
  const linkError = $derived(page.url.searchParams.get("error"));

  let password = $state("");
  let confirm = $state("");
  let loading = $state(false);
  let errorMessage = $state("");
  let done = $state(false);

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    errorMessage = "";
    if (password.length < 8) {
      errorMessage = "Password must be at least 8 characters.";
      return;
    }
    if (password !== confirm) {
      errorMessage = "Passwords don't match.";
      return;
    }
    if (!token) {
      errorMessage = "Missing reset token.";
      return;
    }
    loading = true;
    const { error } = await authClient.resetPassword({ newPassword: password, token });
    loading = false;
    if (error) {
      errorMessage = error.message ?? "Could not reset password. The link may have expired.";
      return;
    }
    done = true;
  }
</script>

<div class="flex min-h-screen items-center justify-center bg-base-200">
  <div class="card w-96 bg-base-100 shadow-xl">
    <div class="card-body">
      <h1 class="card-title justify-center text-2xl">Reset password</h1>

      {#if done}
        <p class="text-success text-sm text-center">Your password has been reset.</p>
        <a href="/login" class="btn btn-primary mt-2">Back to sign in</a>
      {:else if linkError || !token}
        <p class="text-error text-sm text-center">
          This reset link is invalid or has expired.
        </p>
        <a href="/login" class="btn btn-primary mt-2">Request a new link</a>
      {:else}
        <form onsubmit={handleSubmit}>
          <label class="form-control w-full">
            <div class="label"><span class="label-text">New password</span></div>
            <input
              type="password"
              bind:value={password}
              required
              minlength="8"
              placeholder="••••••••"
              class="input input-bordered w-full"
            />
          </label>

          <label class="form-control w-full mt-2">
            <div class="label"><span class="label-text">Confirm new password</span></div>
            <input
              type="password"
              bind:value={confirm}
              required
              minlength="8"
              placeholder="••••••••"
              class="input input-bordered w-full"
            />
          </label>

          {#if errorMessage}
            <p class="text-error text-sm mt-2">{errorMessage}</p>
          {/if}

          <button type="submit" class="btn btn-primary w-full mt-4" disabled={loading}>
            {#if loading}
              <span class="loading loading-spinner"></span>
            {:else}
              Set new password
            {/if}
          </button>
        </form>
      {/if}
    </div>
  </div>
</div>
