import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { meteoriteRegionCounts } from './scripts/meteorite-region-counts.js';

const catalogue = new URL('./src/data/meteorite-catalogue.json', import.meta.url);
const discoveryCountsModule = '\0virtual:meteorite-discovery-counts';
const discoveryCounts = {
  name: 'meteorite-discovery-counts',
  resolveId(id) {
    if (id === 'virtual:meteorite-discovery-counts') return discoveryCountsModule;
  },
  async load(id) {
    if (id !== discoveryCountsModule) return;
    this.addWatchFile(fileURLToPath(catalogue));
    const { rows } = JSON.parse(await readFile(catalogue, 'utf8'));
    const counts = { Fell: 0, Found: 0 };
    for (const [, , , , , status] of rows) {
      if (Object.hasOwn(counts, status)) counts[status]++;
    }
    return `export default ${JSON.stringify(counts)};`;
  },
};
const visitorsPartials = {
  '<!-- visitors-view -->': new URL('./src/visitors-view.html', import.meta.url),
  '<!-- region-chord -->': new URL('./src/region-chord.html', import.meta.url),
};
const embedVisitorsView = {
  name: 'embed-visitors-view',
  transformIndexHtml: {
    order: 'pre',
    async handler(html) {
      const usedPartials = Object.entries(visitorsPartials).filter(([marker]) => html.includes(marker));
      const replacements = await Promise.all(usedPartials.map(async ([marker, url]) =>
        [marker, await readFile(url, 'utf8')]));
      for (const [marker, content] of replacements) html = html.replace(marker, content);
      return html;
    },
  },
};

const continentOutlines = new URL('./src/data/continent-outlines.json', import.meta.url);
const regionCountsModule = '\0virtual:meteorite-region-counts';
const regionCounts = {
  name: 'meteorite-region-counts',
  resolveId(id) {
    if (id === 'virtual:meteorite-region-counts') return regionCountsModule;
  },
  async load(id) {
    if (id !== regionCountsModule) return;
    const inputs = [catalogue, continentOutlines];
    const [records, outlines] = await Promise.all(inputs.map(async url => {
      this.addWatchFile(fileURLToPath(url));
      return JSON.parse(await readFile(url, 'utf8'));
    }));
    return `export default ${JSON.stringify(meteoriteRegionCounts(records, outlines))};`;
  },
};

export default defineConfig({
  plugins: [regionCounts, discoveryCounts, embedVisitorsView],
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
