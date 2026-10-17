// اجرا با: electron scripts/make-icon.js  (assets/icon.png را از لوگوی SVG می‌سازد)
const { app } = require('electron'); const path = require('path'), fs = require('fs');
const { renderIcon } = require('../src/main/icon');
app.whenReady().then(async () => {
  fs.writeFileSync(path.join(__dirname, '../assets/icon.png'), await renderIcon(path.join(__dirname, '../assets/logo.svg'), 512));
  console.log('assets/icon.png ساخته شد'); app.quit();
});
