<script lang="ts">
  import { signUp } from "$lib/sign-up";
  import { goto } from "$app/navigation";

  let email = $state("");
  let password = $state("");
  let loading = $state(false);
  let errorMessage = $state("");

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    errorMessage = "";
    loading = true;

    // No name field on this form — derive a default from the email.
    const name = email.split("@")[0];
    const { error } = await signUp(email, password, name);

    loading = false;

    if (error) {
      errorMessage = error.message ?? "Something went wrong.";
      return;
    }

    // Signed in automatically after sign-up — go to the dashboard.
    await goto("/dashboard");
  }
</script>

<div class="flex min-h-screen items-center justify-center bg-base-200">
  <div class="card w-96 bg-base-100 shadow-xl">

    <form class="card-body" onsubmit={handleSubmit}>
      <h1 class="card-title justify-center text-2xl">
        Create account
      </h1>

      <label class="form-control w-full">
        <div class="label">
          <span class="label-text">Email</span>
        </div>
        <input
          type="email"
          bind:value={email}
          required
          placeholder="you@example.com"
          class="input input-bordered w-full"
        />
      </label>

      <label class="form-control w-full mt-2">
        <div class="label">
          <span class="label-text">Password</span>
        </div>
        <input
          type="password"
          bind:value={password}
          required
          minlength="8"
          placeholder="••••••••"
          class="input input-bordered w-full"
        />
      </label>

      {#if errorMessage}
        <p class="text-error text-sm mt-2">{errorMessage}</p>
      {/if}

      <div class="mt-4">
        <button type="submit" class="btn btn-primary w-full" disabled={loading}>
          {#if loading}
            <span class="loading loading-spinner"></span>
          {:else}
            Sign up
          {/if}
        </button>
      </div>
    </form>
  </div>
</div>
