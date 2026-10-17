const { app, safeStorage } = require('electron');
const fs = require('fs'), path = require('path');
const file = () => path.join(app.getPath('userData'), 'nova-connect.dat');
const DEFAULT = { subscription: null, servers: [], stats: {}, lastGood: null, proxyBackup: null, proxyOwned: false,
  settings: { theme: 'dark', autoStart: false, minimizeToTray: true, autoConnect: false, pingInterval: 45, retries: 3, testUrl: 'http://cp.cloudflare.com/generate_204' } };
let data = structuredClone(DEFAULT);
function load() {
  try {
    const j = JSON.parse(fs.readFileSync(file(), 'utf8'));
    const p = JSON.parse(j.enc ? safeStorage.decryptString(Buffer.from(j.data, 'base64')) : j.data);
    data = { ...structuredClone(DEFAULT), ...p, settings: { ...DEFAULT.settings, ...p.settings } };
  } catch {}
  return data;
}
function save() {
  const txt = JSON.stringify(data);
  const out = safeStorage.isEncryptionAvailable() ? { enc: true, data: safeStorage.encryptString(txt).toString('base64') } : { enc: false, data: txt };
  const tmp = file() + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(out)); fs.renameSync(tmp, file());
}
module.exports = { load, save, get: () => data };
