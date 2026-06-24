<script lang="ts">
  import { signUp } from "$lib/sign-up";
  import { signIn } from "$lib/sign-in";
  import { authClient } from "$lib/auth-client";
  import { goto } from "$app/navigation";

  let mode = $state<"signin" | "signup" | "forgot">("signin");
  let email = $state("");
  let password = $state("");
  let loading = $state(false);
  let errorMessage = $state("");
  let notice = $state("");

  function setMode(next: typeof mode) {
    mode = next;
    errorMessage = "";
    notice = "";
  }

  const titles = {
    signin: "Sign in",
    signup: "Create account",
    forgot: "Reset password",
  } as const;

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    errorMessage = "";
    notice = "";
    loading = true;

    if (mode === "forgot") {
      // Sends a reset email (see sendResetPassword in src/lib/server/auth.ts).
      // The link lands on /reset-password with a token in the query string.
      const { error } = await authClient.requestPasswordReset({
        email,
        redirectTo: "/reset-password",
      });
      loading = false;
      if (error) {
        errorMessage = error.message ?? "Could not send the reset email.";
        return;
      }
      // Don't reveal whether the email exists — same message either way.
      notice = "If an account exists for that email, a reset link is on its way.";
      return;
    }

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
      <a href="/" class="link link-hover self-start text-sm text-base-content/60">← Home</a>
      <h1 class="card-title justify-center text-2xl">{titles[mode]}</h1>

      {#if mode === "forgot"}
        <p class="text-center text-sm text-base-content/60">
          Enter your email and we'll send you a link to reset your password.
        </p>
      {/if}

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

      {#if mode !== "forgot"}
        <label class="form-control w-full mt-2">
          <div class="label">
            <span class="label-text">Password</span>
            {#if mode === "signin"}
              <button
                type="button"
                class="link link-hover label-text-alt"
                onclick={() => setMode("forgot")}
              >
                Forgot password?
              </button>
            {/if}
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
      {/if}

      {#if errorMessage}
        <p class="text-error text-sm mt-2">{errorMessage}</p>
      {/if}
      {#if notice}
        <p class="text-success text-sm mt-2">{notice}</p>
      {/if}

      <div class="mt-4">
        <button type="submit" class="btn btn-primary w-full" disabled={loading}>
          {#if loading}
            <span class="loading loading-spinner"></span>
          {:else if mode === "forgot"}
            Send reset link
          {:else if mode === "signin"}
            Sign in
          {:else}
            Sign up
          {/if}
        </button>
      </div>

      {#if mode === "forgot"}
        <p class="mt-2 text-center text-sm text-base-content/60">
          <button type="button" class="link link-primary" onclick={() => setMode("signin")}>
            ← Back to sign in
          </button>
        </p>
      {:else}
        <p class="mt-2 text-center text-sm text-base-content/60">
          {mode === "signin" ? "Don't have an account?" : "Already have an account?"}
          <button
            type="button"
            class="link link-primary"
            onclick={() => setMode(mode === "signin" ? "signup" : "signin")}
          >
            {mode === "signin" ? "Create one" : "Sign in"}
          </button>
        </p>
      {/if}
    </form>
  </div>
</div>
