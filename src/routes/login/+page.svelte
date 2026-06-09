<script lang="ts">
  import { signUp } from "$lib/sign-up";
  import { signIn } from "$lib/sign-in";
  import { goto } from "$app/navigation";

  let mode = $state<"signin" | "signup">("signin");
  let email = $state("");
  let password = $state("");
  let loading = $state(false);
  let errorMessage = $state("");

  function toggleMode() {
    mode = mode === "signin" ? "signup" : "signin";
    errorMessage = "";
  }

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    errorMessage = "";
    loading = true;

    let error;
    if (mode === "signup") {
      // No name field on this form — derive a default from the email.
      const name = email.split("@")[0];
      ({ error } = await signUp(email, password, name));
    } else {
      ({ error } = await signIn(email, password));
    }

    loading = false;

    if (error) {
      errorMessage = error.message ?? "Something went wrong.";
      return;
    }

    // Signed in (new account is signed in automatically) — go to the dashboard.
    await goto("/dashboard");
  }
</script>

<div class="flex min-h-screen items-center justify-center bg-base-200">
  <div class="card w-96 bg-base-100 shadow-xl">

    <form class="card-body" onsubmit={handleSubmit}>
      <h1 class="card-title justify-center text-2xl">
        {mode === "signin" ? "Sign in" : "Create account"}
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
            {mode === "signin" ? "Sign in" : "Sign up"}
          {/if}
        </button>
      </div>

      <p class="mt-2 text-center text-sm text-base-content/60">
        {mode === "signin" ? "Don't have an account?" : "Already have an account?"}
        <button type="button" class="link link-primary" onclick={toggleMode}>
          {mode === "signin" ? "Create one" : "Sign in"}
        </button>
      </p>
    </form>
  </div>
</div>
