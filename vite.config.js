import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

const catalogue = new URL('./src/data/meteorite-catalogue.json', import.meta.url);
const visitorsView = new URL('./src/visitors-view.html', import.meta.url);
const embedVisitorsView = {
  name: 'embed-visitors-view',
  transformIndexHtml: {
    order: 'pre',
    async handler(html) {
      const marker = '<!-- visitors-view -->';
      if (!html.includes(marker)) return;
      return html.replace(marker, await readFile(visitorsView, 'utf8'));
    },
  },
};
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
  plugins: [originsClassCounts, embedVisitorsView],
  build: {
    rollupOptions: {
      input: {
        specimen: fileURLToPath(new URL('./index.html', import.meta.url)),
        visitors: fileURLToPath(new URL('./visitors.html', import.meta.url)),
        opening: fileURLToPath(new URL('./sleep-well/index.html', import.meta.url)),
      },
    },
  },
});
