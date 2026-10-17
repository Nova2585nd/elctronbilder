const { BrowserWindow, nativeImage } = require('electron');
const fs = require('fs');
async function renderIcon(svgPath, size = 512) {
  const svg = fs.readFileSync(svgPath, 'utf8');
  const w = new BrowserWindow({ show: false, width: size, height: size, transparent: true, frame: false, webPreferences: { offscreen: false } });
  await w.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(`<body style="margin:0;background:transparent"><div style="width:${size}px;height:${size}px">${svg.replace('<svg ', '<svg width="100%" height="100%" ')}</div>`));
  await new Promise((r) => setTimeout(r, 300));
  const img = await w.webContents.capturePage(); w.destroy();
  return img.resize({ width: size, height: size }).toPNG();
}
module.exports = { renderIcon, nativeImage };
