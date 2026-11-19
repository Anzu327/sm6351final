import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

const catalogue = new URL('./src/data/meteorite-catalogue.json', import.meta.url);
const classCountsModule = '\0virtual:origins-class-counts';
const originsClassCounts = {
  name: 'origins-class-counts',
  resolveId(id) {
    if (id === 'virtual:origins-class-counts') return classCountsModule;
  },
  async load(id) {
    if (id !== classCountsModule) return;
    this.addWatchFile(fileURLToPath(catalogue));
    const { rows } = JSON.parse(await readFile(catalogue, 'utf8'));
    const counts = ['H5', 'L5', 'LL5'].map(name => ({ name, official: 0, fell: 0 }));
    const byClass = new Map(counts.map(entry => [entry.name, entry]));
    for (const [, , , , classification, recovery, , , naming] of rows) {
      const count = byClass.get(classification);
      if (!count || naming !== 'Official') continue;
      count.official += 1;
      if (recovery === 'Fell') count.fell += 1;
    }
    return `export default ${JSON.stringify(counts)};`;
  },
};

export default defineConfig({
  plugins: [originsClassCounts],
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
