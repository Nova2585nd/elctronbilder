const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, Notification } = require('electron');
const path = require('path'), fs = require('fs');
const log = require('./logger'), storage = require('./storage'), sub = require('./subscription');
const monitor = require('./monitor'), selector = require('./selector'), network = require('./network'), xray = require('./xray');
const { Connection } = require('./connection'); const { renderIcon } = require('./icon');

let win, tray, db, conn, quitting = false, testing = false, lastCheckAt = null, pushTimer = null;
const assets = (f) => path.join(__dirname, '../../assets', f);
if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => { if (win) { win.show(); win.focus(); } });

const save = () => { try { storage.save(); } catch (e) { log.error('save failed', e.message); } };
function snapshot() {
  const rec = selector.recommended(db.servers, db.stats), def = selector.defaultServer(db.servers, db.stats, db.lastGood);
  return { conn: conn.state, version: app.getVersion(), settings: db.settings, testing, lastCheckAt, recommendedId: rec, defaultId: def,
    subscription: db.subscription && { updatedAt: db.subscription.updatedAt, count: db.servers.length, error: db.subscription.error || null },
    servers: db.servers.map((s) => ({ id: s.uid, name: s.name, protocol: s.protocol, ...db.stats[s.uid] })) };
}
function push() { clearTimeout(pushTimer); pushTimer = setTimeout(() => { if (win && !win.isDestroyed()) win.webContents.send('state', snapshot()); updateTray(); }, 60); }

async function runTests() {
  if (testing || !db.servers.length) return; testing = true; push();
  for (const s of db.servers) db.stats[s.uid] = { ...db.stats[s.uid], status: db.stats[s.uid]?.latency != null ? db.stats[s.uid].status : 'testing' };
  try {
    await monitor.testAll(db.servers, db.settings.testUrl, (s, ms, tcp) => {
      const old = db.stats[s.uid] || {};
      if (ms != null) db.stats[s.uid] = { status: 'ok', latency: ms, at: Date.now(), fails: 0 };
      else if (tcp) db.stats[s.uid] = { status: 'unverified', latency: null, at: Date.now(), fails: old.fails || 0 };
      else db.stats[s.uid] = { status: 'fail', latency: null, at: Date.now(), fails: (old.fails || 0) + 1, badUntil: old.badUntil };
      push();
    });
  } catch (e) { log.error('tests failed', e.message); }
  testing = false; lastCheckAt = Date.now(); save(); push();
}

async function applySubscription(url) {
  const hadServers = db.servers.length > 0;
  try {
    const r = await sub.fetchSubscription(url);
    const keep = {}; for (const s of r.servers) if (db.stats[s.uid]) keep[s.uid] = db.stats[s.uid];
    db.servers = r.servers; db.stats = keep; db.subscription = { url, updatedAt: Date.now(), error: null }; save(); push();
    runTests(); return { ok: true, unsupported: r.unsupported };
  } catch (e) {
    if (hadServers && db.subscription) { db.subscription.error = e.message; save(); push(); } // آخرین نسخه سالم حفظ می‌شود
    return { ok: false, error: e.message };
  }
}
const wrap = (fn) => async (...a) => { try { return await fn(...a); } catch (e) { return { ok: false, error: e.message }; } };

let iconPath = assets('icon.png');
async function ensureIcon() {
  if (fs.existsSync(iconPath)) return;
  try { iconPath = path.join(app.getPath('userData'), 'icon.png'); if (!fs.existsSync(iconPath)) fs.writeFileSync(iconPath, await renderIcon(assets('logo.svg'), 512)); }
  catch (e) { log.error('icon', e.message); }
}
function createWindow() {
  win = new BrowserWindow({ width: 460, height: 740, minWidth: 380, minHeight: 560, show: false, backgroundColor: '#080D0B', title: 'Nova Connect',
    icon: nativeImage.createFromPath(iconPath),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), nodeIntegration: false, contextIsolation: true, sandbox: true } });
  win.setMenu(null); win.loadFile(path.join(__dirname, '../renderer/index.html'));
  win.once('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' })); win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.on('close', (e) => { if (!quitting && db.settings.minimizeToTray) { e.preventDefault(); win.hide(); } });
}
async function makeTray() {
  tray = new Tray(nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 }));
  tray.setToolTip('Nova Connect'); tray.on('click', () => { win.show(); win.focus(); }); updateTray();
}
function updateTray() {
  if (!tray) return; const on = conn.state.status === 'connected';
  tray.setContextMenu(Menu.buildFromTemplate([{ label: 'نمایش برنامه', click: () => win.show() },
    { label: on ? 'قطع اتصال' : 'اتصال', click: () => (on ? conn.disconnect() : connectDefault()) }, { type: 'separator' }, { label: 'خروج کامل', click: () => quit() }]));
}
const connectDefault = () => { const id = selector.defaultServer(db.servers, db.stats, db.lastGood); return id ? conn.connect(id) : { ok: false, error: 'سروری برای اتصال وجود ندارد.' }; };
async function quit() { if (quitting) return; quitting = true; try { await conn.disconnect(); } catch {} xray.killAll(); app.exit(0); }

app.whenReady().then(async () => {
  log.init(path.join(app.getPath('userData'), 'logs')); db = storage.load();
  conn = new Connection(db, save, runTests); conn.on('change', push);
  if (db.proxyOwned) await network.restore(db, save).catch(() => {}); // بازیابی بعد از بسته‌شدن ناگهانی قبلی
  await ensureIcon(); createWindow(); await makeTray();
  ipcMain.handle('state', () => snapshot());
  ipcMain.handle('sub:add', wrap((_e, url) => applySubscription(url)));
  ipcMain.handle('sub:refresh', wrap(() => (db.subscription ? applySubscription(db.subscription.url) : { ok: false, error: 'اشتراکی ثبت نشده است.' })));
  ipcMain.handle('sub:remove', wrap(async () => { await conn.disconnect(); Object.assign(db, { subscription: null, servers: [], stats: {}, lastGood: null }); save(); push(); return { ok: true }; }));
  ipcMain.handle('conn:connect', wrap(async (_e, id) => { const t = id || selector.defaultServer(db.servers, db.stats, db.lastGood); if (!t) return { ok: false, error: 'سروری برای اتصال وجود ندارد.' }; conn.connect(t); return { ok: true }; }));
  ipcMain.handle('conn:disconnect', wrap(async () => { await conn.disconnect(); return { ok: true }; }));
  ipcMain.handle('test', wrap(async () => { runTests(); return { ok: true }; }));
  ipcMain.handle('settings', wrap(async (_e, p) => {
    const ok = { theme: ['dark', 'light'], autoStart: 'b', minimizeToTray: 'b', autoConnect: 'b', pingInterval: [30, 45, 60, 120], retries: [2, 3, 4, 5] };
    for (const [k, v] of Object.entries(p || {})) if (k in ok && (ok[k] === 'b' ? typeof v === 'boolean' : ok[k].includes(v))) db.settings[k] = v;
    app.setLoginItemSettings({ openAtLogin: !!db.settings.autoStart }); save(); push(); return { ok: true };
  }));
  ipcMain.handle('logs', () => log.tail(200)); ipcMain.handle('quit', () => quit());
  setInterval(() => { const active = win && win.isVisible() || conn.state.status === 'connected';
    if (active && !testing && Date.now() - (lastCheckAt || 0) >= db.settings.pingInterval * 1000) runTests(); }, 5000);
  if (db.servers.length) runTests();
  if (db.settings.autoConnect && db.servers.length) setTimeout(connectDefault, 1500);
});
app.on('before-quit', (e) => { if (!quitting) { e.preventDefault(); quit(); } });
app.on('window-all-closed', () => {});
