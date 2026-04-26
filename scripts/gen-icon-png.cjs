// Generates a 256x256 PNG icon for macOS (electron-builder converts to .icns automatically)
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c;
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeB = Buffer.from(type, 'ascii');
  const crcInput = Buffer.concat([typeB, data]);
  const crcB = Buffer.alloc(4);
  crcB.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([len, typeB, data, crcB]);
}

const w = 256, h = 256;
const rgba = Buffer.alloc(w * h * 4);

for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    const idx = (y * w + x) * 4;
    const cx = x - 127.5, cy = y - 127.5;
    const dist = Math.sqrt(cx * cx + cy * cy);
    if (dist <= 120) {
      rgba[idx]     = 0x4A; // R
      rgba[idx + 1] = 0x7A; // G
      rgba[idx + 2] = 0x5A; // B
      rgba[idx + 3] = 0xFF; // A
      if ((Math.abs(cx) < 16 && Math.abs(cy) < 60) || (Math.abs(cy) < 16 && Math.abs(cx) < 60)) {
        rgba[idx] = rgba[idx + 1] = rgba[idx + 2] = 0xF5;
        rgba[idx + 3] = 0xFF;
      }
    } else {
      rgba[idx] = rgba[idx + 1] = rgba[idx + 2] = rgba[idx + 3] = 0;
    }
  }
}

// Build raw scanlines (filter byte 0 = None before each row)
const raw = Buffer.alloc(h * (1 + w * 4));
for (let y = 0; y < h; y++) {
  raw[y * (1 + w * 4)] = 0;
  rgba.copy(raw, y * (1 + w * 4) + 1, y * w * 4, (y + 1) * w * 4);
}

const compressed = zlib.deflateSync(raw, { level: 6 });

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(w, 0);
ihdr.writeUInt32BE(h, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // RGBA
ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
const png = Buffer.concat([sig, makeChunk('IHDR', ihdr), makeChunk('IDAT', compressed), makeChunk('IEND', Buffer.alloc(0))]);

const outPath = path.join(__dirname, '..', 'public', 'icon.png');
fs.mkdirSync(path.join(__dirname, '..', 'public'), { recursive: true });
fs.writeFileSync(outPath, png);
console.log('PNG icon created:', outPath, `(${png.length} bytes)`);
