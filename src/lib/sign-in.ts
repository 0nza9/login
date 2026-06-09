import { authClient } from "./auth-client"; //import the auth client

export async function signIn(
    email: string, // user email address
    password: string, // user password
) {
    // The caller handles loading state, errors, and redirect via the
    // returned { data, error } — see src/routes/login/+page.svelte.
    const { data, error } = await authClient.signIn.email({
        email,
        password,
    });

    return { data, error };
}
