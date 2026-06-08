import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: {
		// Match BETTER_AUTH_URL in .env so Better Auth trusts this origin.
		port: 5175
	}
});
