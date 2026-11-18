import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        specimen: fileURLToPath(new URL('./index.html', import.meta.url)),
        visitors: fileURLToPath(new URL('./visitors.html', import.meta.url)),
        opening: fileURLToPath(new URL('./sleep-well/opening.html', import.meta.url)),
      },
    },
  },
});
