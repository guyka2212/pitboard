// Renders build/icon.svg into build/icon.ico (PNG-compressed entries, 16-256 px).
// Run with: npm run icon
const fs = require('fs');
const path = require('path');
const { app, BrowserWindow } = require('electron');

const SIZES = [16, 20, 24, 32, 40, 48, 64, 128, 256];
const root = path.join(__dirname, '..');
const svg = fs.readFileSync(path.join(root, 'build', 'icon.svg'), 'utf8');

function packIco(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2); // 1 = icon
  header.writeUInt16LE(pngs.length, 4);

  let offset = 6 + 16 * pngs.length;
  const entries = pngs.map(({ size, data }) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0); // 0 means 256
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    return entry;
  });
  return Buffer.concat([header, ...entries, ...pngs.map((p) => p.data)]);
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false });
  await win.loadURL('data:text/html,<!doctype html><title>icon</title>');
  const dataUrls = await win.webContents.executeJavaScript(`
    (async () => {
      const img = new Image();
      img.src = 'data:image/svg+xml;base64,' + ${JSON.stringify(Buffer.from(svg).toString('base64'))};
      await img.decode();
      return ${JSON.stringify(SIZES)}.map((size) => {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, size, size);
        return canvas.toDataURL('image/png');
      });
    })()
  `);
  const pngs = dataUrls.map((url, i) => ({ size: SIZES[i], data: Buffer.from(url.split(',')[1], 'base64') }));
  fs.writeFileSync(path.join(root, 'build', 'icon.ico'), packIco(pngs));
  fs.writeFileSync(path.join(root, 'build', 'icon.png'), pngs[pngs.length - 1].data);
  console.log(`build/icon.ico: ${SIZES.join(', ')} px`);
  app.exit(0);
});
