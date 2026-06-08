import { authClient } from "./auth-client"; //import the auth client

export async function signUp(
    email: string, // user email address
    password: string, // user password -> min 8 characters by default
    name: string, // user display name
    image?: string, // User image URL (optional)
) {
    // The caller handles loading state, errors, and redirect via the
    // returned { data, error } — see src/routes/login/+page.svelte.
    const { data, error } = await authClient.signUp.email({
        email,
        password,
        name,
        image,
    });

    return { data, error };
}