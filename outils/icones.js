// Génère les icônes PNG de Zephir (« Vague » : cercle coupé par une vague) sans dépendance.
// Lancer depuis C:\KairOs :  node outils/icones.js
const fs = require('fs'), zlib = require('zlib'), path = require('path');

// couleurs alignées sur style.css (--bg, --ehpad, --txt)
const BG = [11, 13, 18], BLUE = [124, 156, 255], WHITE = [236, 238, 242];

function draw(size, pad) { // pad : marge de sécurité (icônes "maskable" rognées en rond)
  const px = Buffer.alloc(size * size * 4), c = size / 2, R = size * (0.5 - pad);
  const u = R * 0.6 / 40; // repère du logo.svg : cercle de rayon 40 centré en (50,50)
  const SS = 4; // sur-échantillonnage pour des bords lisses
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let acc = [0, 0, 0];
    for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
      const X = (x + (sx + .5) / SS - c) / u + 50, Y = (y + (sy + .5) / SS - c) / u + 50;
      let col = BG;
      // vague : sinusoïde quasi identique aux courbes de logo.svg ; dessus blanc, dessous bleu
      if (Math.hypot(X - 50, Y - 50) <= 40) col = Y < 50 - 10.5 * Math.sin(2 * Math.PI * (X - 8) / 84) ? WHITE : BLUE;
      acc = acc.map((v, i) => v + col[i]);
    }
    const o = (y * size + x) * 4;
    px[o] = acc[0] / SS / SS; px[o + 1] = acc[1] / SS / SS; px[o + 2] = acc[2] / SS / SS; px[o + 3] = 255;
  }
  return png(size, px);
}

function png(size, px) {
  const crcT = Array.from({ length: 256 }, (_, n) => { for (let k = 0; k < 8; k++) n = n & 1 ? 0xEDB88320 ^ (n >>> 1) : n >>> 1; return n >>> 0; });
  const crc = b => { let c = ~0; for (const v of b) c = crcT[(c ^ v) & 255] ^ (c >>> 8); return (~c) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const cr = Buffer.alloc(4); cr.writeUInt32BE(crc(td)); return Buffer.concat([l, td, cr]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const out = path.join(__dirname, '..', 'icones');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'icone-192.png'), draw(192, 0.04));
fs.writeFileSync(path.join(out, 'icone-512.png'), draw(512, 0.04));
fs.writeFileSync(path.join(out, 'icone-maskable-512.png'), draw(512, 0.14));
fs.writeFileSync(path.join(out, 'apple-touch-icon.png'), draw(180, 0.08));
console.log('Icônes créées dans', out);
