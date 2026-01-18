import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
	test: {
		globals: true,
		include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
		// Use happy-dom for tests that need DOM APIs (better ESM compatibility)
		environment: 'happy-dom',
		// Longer timeout for OSMD rendering tests
		testTimeout: 15000,
		// Server config for ESM/CJS compatibility
		server: {
			deps: {
				inline: ['opensheetmusicdisplay'],
			},
		},
	},
	resolve: {
		alias: {
			'@': path.resolve(__dirname, './src'),
		},
		// Prefer browser builds for conditional exports
		conditions: ['browser'],
	},
});
