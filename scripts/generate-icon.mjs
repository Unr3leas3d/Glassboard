import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync } from 'fs';

const svg = readFileSync('app-icon-source.svg', 'utf8');

// Render at 1024x1024
const resvg = new Resvg(svg, {
  fitTo: { mode: 'width', value: 1024 },
  background: 'rgba(0, 0, 0, 0)',
});

const pngData = resvg.render();
const pngBuffer = pngData.asPng();

writeFileSync('app-icon-source.png', pngBuffer);
console.log('Generated app-icon-source.png (1024x1024)');
