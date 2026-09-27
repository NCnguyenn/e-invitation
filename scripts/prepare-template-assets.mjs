// Reproduce the local font/asset bundle. Original source files remain untouched.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
const templateDir = 'public/templates/wedding-floral-01';
mkdirSync(templateDir, { recursive: true });
for (const file of readdirSync('images')) copyFileSync(join('images', file), join(templateDir, file));
const families = {
  'be-vietnam-pro': [400, 500, 600, 700, 800], inter: [500, 600, 700],
  merriweather: [700], windsong: [500], 'qwitcher-grypen': [700],
  'patrick-hand': [400], ephesis: [400], 'playfair-display': [500, 600],
  itim: [400], borel: [400], 'vujahday-script': [400], 'viaoda-libre': [400],
};
let fonts = '/* Self-hosted Fontsource fonts. Licenses: public/fonts/<family>/LICENSE. */\n';
for (const [family, weights] of Object.entries(families)) {
  const from = `node_modules/@fontsource/${family}`;
  const to = `public/fonts/${family}`;
  mkdirSync(to, { recursive: true });
  copyFileSync(`${from}/LICENSE`, `${to}/LICENSE`);
  for (const weight of weights) {
    const source = readFileSync(`${from}/${weight}.css`, 'utf8');
    for (const block of source.matchAll(/\/\* [^*]*(?:vietnamese|latin|latin-ext)-[^*]*\*\/\s*@font-face\s*\{[^}]+\}/g)) {
      let css = block[0].replace(/, url\([^)]*\.woff\) format\('woff'\)/g, '');
      css = css.replace(/\.\/files\/([^)]*\.woff2)/g, (_, file) => {
        copyFileSync(`${from}/files/${file}`, `${to}/${file}`);
        // Resolve via Next's CSS pipeline so fonts get content hashes and immutable caching.
        return `../../../public/fonts/${family}/${file}`;
      });
      fonts += `${css}\n`;
    }
  }
}
writeFileSync('src/features/template/fonts.css', fonts);
