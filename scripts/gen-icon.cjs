// Generates a minimal valid 32x32 ICO file for the app icon
// (green circle with a leaf symbol)
const fs = require('fs');
const path = require('path');

// Minimal 1x1 ICO as a valid placeholder - electron-builder will use it
// We'll create a proper 32x32 green icon using raw BMP data

function createIco() {
  // ICO header: 1 image, 256x256, 32-bit color
  const w = 256, h = 256;

  // BMP pixel data (BGRA, bottom-up)
  const pixels = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = ((h - 1 - y) * w + x) * 4;
      const cx = x - 127.5, cy = y - 127.5;
      const dist = Math.sqrt(cx*cx + cy*cy);
      if (dist <= 120) {
        // Background circle: sage green #4A7A5A
        pixels[idx]   = 0x5A; // B
        pixels[idx+1] = 0x7A; // G
        pixels[idx+2] = 0x4A; // R
        pixels[idx+3] = 0xFF; // A
        // White cross symbol in the center
        if ((Math.abs(cx) < 16 && Math.abs(cy) < 60) || (Math.abs(cy) < 16 && Math.abs(cx) < 60)) {
          pixels[idx]   = 0xF5;
          pixels[idx+1] = 0xF5;
          pixels[idx+2] = 0xF5;
          pixels[idx+3] = 0xFF;
        }
      } else {
        // Transparent outside circle
        pixels[idx] = pixels[idx+1] = pixels[idx+2] = pixels[idx+3] = 0;
      }
    }
  }

  // BMP DIB header (BITMAPINFOHEADER = 40 bytes)
  const dibHeader = Buffer.alloc(40);
  dibHeader.writeUInt32LE(40, 0);      // header size
  dibHeader.writeInt32LE(w, 4);        // width
  dibHeader.writeInt32LE(h * 2, 8);   // height * 2 (ICO convention)
  dibHeader.writeUInt16LE(1, 12);      // color planes
  dibHeader.writeUInt16LE(32, 14);     // bits per pixel
  dibHeader.writeUInt32LE(0, 16);      // compression (none)
  dibHeader.writeUInt32LE(pixels.length, 20); // image size
  // rest are 0

  // AND mask (all zeros = fully opaque for 32-bit icon)
  const andMask = Buffer.alloc(Math.ceil(w / 8) * h, 0);

  const imageData = Buffer.concat([dibHeader, pixels, andMask]);

  // ICO file header (6 bytes)
  const icoHeader = Buffer.alloc(6);
  icoHeader.writeUInt16LE(0, 0);  // reserved
  icoHeader.writeUInt16LE(1, 2);  // type: 1 = ICO
  icoHeader.writeUInt16LE(1, 4);  // image count: 1

  // ICO directory entry (16 bytes)
  const dirEntry = Buffer.alloc(16);
  dirEntry.writeUInt8(0, 0);      // width: 0 means 256
  dirEntry.writeUInt8(0, 1);      // height: 0 means 256
  dirEntry.writeUInt8(0, 2);      // colors (0 = 256+)
  dirEntry.writeUInt8(0, 3);      // reserved
  dirEntry.writeUInt16LE(1, 4);   // color planes
  dirEntry.writeUInt16LE(32, 6);  // bits per pixel
  dirEntry.writeUInt32LE(imageData.length, 8); // data size
  dirEntry.writeUInt32LE(6 + 16, 12); // data offset

  const ico = Buffer.concat([icoHeader, dirEntry, imageData]);
  const outPath = path.join(__dirname, '..', 'public', 'icon.ico');
  fs.mkdirSync(path.join(__dirname, '..', 'public'), { recursive: true });
  fs.writeFileSync(outPath, ico);
  console.log('Icon created:', outPath, `(${ico.length} bytes)`);
}

createIco();
