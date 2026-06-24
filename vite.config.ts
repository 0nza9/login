import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: {
		// Match BETTER_AUTH_URL in .env so Better Auth trusts this origin.
		port: 5175,
		// Fail loudly if 5175 is taken instead of silently drifting to 5176,
		// which isn't a trusted origin and breaks sign-in ("Invalid origin").
		strictPort: true
	}
});
