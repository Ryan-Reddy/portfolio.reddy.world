// Makes the picture mark: Ryan's Laser Unicorn as black-and-white ASCII art.
// (Ryan, 2026-10-25: "a small corner is good, pehaps the unicorn in blackandwhite ascii")
//
//   node scripts/watermark/make-mark.mjs
//
// unicorn-source.jpg (a small grey copy of "unicorn laser eyes crop.jpeg") -> unicorn.txt
// (the ASCII, luminance to a character ramp) -> mark-white.png and mark-black.png (the
// ASCII in a monospace font on a transparent ground, with a thin outline in the opposite
// colour so it reads on busy corners). The build (scripts/watermark.mjs) only reads the PNGs,
// so every machine stamps the same mark; run this again only to change the mark itself.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';
import sharp from 'sharp';

const at = (name) => fileURLToPath(new URL(name, import.meta.url));
const COLS = 48;            // characters per line
const CELL = 0.55;          // a monospace character's width / height
const RAMP = ' .:-=+*#%@';  // dark (the black ground: nothing) to bright (the white unicorn)
const FONT = 24;            // px, rendered large; the build scales it down per picture

// 1. ASCII: one character per cell, by the cell's mean brightness
const src = sharp(at('unicorn-source.jpg'));
const { width, height } = await src.metadata();
const rows = Math.round((COLS * height / width) * CELL);
const { data } = await src.clone().greyscale().resize(COLS, rows, { fit: 'fill', kernel: 'lanczos3' })
  .normalise().sharpen({ sigma: 0.6 }).raw().toBuffer({ resolveWithObject: true });
const lines = [];
for (let y = 0; y < rows; y++) {
  let line = '';
  for (let x = 0; x < COLS; x++) {
    const v = data[y * COLS + x] / 255;
    // the painted black ground is not quite black: everything under 18% is ground
    const t = Math.max(0, (v - 0.18) / 0.82);
    line += RAMP[Math.min(RAMP.length - 1, Math.round(t ** 0.8 * (RAMP.length - 1)))];
  }
  lines.push(line.replace(/\s+$/, ''));
}
while (lines.length && !lines[0].trim()) lines.shift();
while (lines.length && !lines.at(-1).trim()) lines.pop();
const ascii = lines.join('\n');
writeFileSync(at('unicorn.txt'), `${ascii}\n`);

// 2. PNG: the ASCII in a bold monospace font, one <text> per line, with reddy.world in gold under
// it (Ryan, 2026-10-25: "got reddy.world in gold under it like a qr"). The -qr marks add a QR code
// for https://reddy.world/ beside it, for pictures large enough for a phone to read it.
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const GOLD = '#c7a86d';     // the site's --gold
const w = Math.ceil(COLS * FONT * CELL) + 8;
const art = lines.length * FONT + 8;
const NAME = Math.round(FONT * 2.4);
const h = art + NAME;
// the QR code: black modules on a white tile, one module of quiet zone, as tall as the mark
const qr = QRCode.create('https://reddy.world/', { errorCorrectionLevel: 'M' }).modules;
const cells = qr.size + 2;
const unit = h / cells;
const GAP = Math.round(FONT * 0.8);
let modules = '';
for (let y = 0; y < qr.size; y++) {
  for (let x = 0; x < qr.size; x++) {
    if (qr.get(x, y)) modules += `M${((x + 1) * unit).toFixed(2)} ${((y + 1) * unit).toFixed(2)}h${unit.toFixed(2)}v${unit.toFixed(2)}h-${unit.toFixed(2)}z`;
  }
}
const qrTile = (x) => `<g transform="translate(${x} 0)"><rect width="${h}" height="${h}" fill="#fff"/><path d="${modules}" fill="#000"/></g>`;
const svg = (fill, stroke, withQr) => `<svg xmlns="http://www.w3.org/2000/svg" width="${withQr ? w + GAP + h : w}" height="${h}">
  <g font-family="Consolas, 'DejaVu Sans Mono', 'Courier New', monospace" font-weight="700" font-size="${FONT}"
     fill="${fill}" stroke="${stroke}" stroke-width="5" stroke-opacity="0.8" paint-order="stroke" xml:space="preserve">
${lines.map((l, i) => `    <text x="4" y="${4 + (i + 0.8) * FONT}" textLength="${(l.length * FONT * CELL).toFixed(1)}" lengthAdjust="spacingAndGlyphs">${esc(l)}</text>`).join('\n')}
  </g>
  <text x="${w / 2}" y="${art + NAME * 0.78}" text-anchor="middle" textLength="${w - 12}" lengthAdjust="spacingAndGlyphs"
     font-family="Georgia, 'Times New Roman', serif" font-weight="700" font-size="${NAME}" fill="${GOLD}"
     stroke="${stroke}" stroke-width="5" stroke-opacity="0.8" paint-order="stroke">reddy.world</text>
  ${withQr ? qrTile(w + GAP) : ''}
</svg>`;
for (const [name, fill, stroke] of [['white', '#fff', '#000'], ['black', '#000', '#fff']]) {
  await sharp(Buffer.from(svg(fill, stroke, false))).png({ compressionLevel: 9 }).toFile(at(`mark-${name}.png`));
  await sharp(Buffer.from(svg(fill, stroke, true))).png({ compressionLevel: 9 }).toFile(at(`mark-${name}-qr.png`));
}
console.log(ascii);
console.log(`\n${COLS} x ${lines.length} characters; marks ${w} x ${h} px, with the QR code ${w + GAP + h} x ${h} px (QR ${qr.size} modules)`);
