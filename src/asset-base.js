const base = import.meta.env.BASE_URL;
// With a relative Vite base, bundled modules sit one level below the public assets.
export const assetBase = new URL(base === './' ? '../' : base, import.meta.url).href;
