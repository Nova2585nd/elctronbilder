const { app } = require('electron');
const { spawn, execFile } = require('child_process');
const { EventEmitter } = require('events');
const fs = require('fs'), path = require('path'), net = require('net'), crypto = require('crypto');
const { buildConfig } = require('./xray-config');
const log = require('./logger');
const procs = new Set();

function binary() {
  const exe = process.platform === 'win32' ? 'xray.exe' : 'xray';
  const p = app.isPackaged ? path.join(process.resourcesPath, 'xray', exe) : path.join(__dirname, '../../resources/xray', exe);
  if (!fs.existsSync(p)) throw new Error('هسته Xray پیدا نشد. دستور npm run fetch-xray را اجرا کنید.');
  return p;
}
const freePort = () => new Promise((res, rej) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); s.on('error', rej); });
const canConnect = (port) => new Promise((res) => { const c = net.connect(port, '127.0.0.1'); c.once('connect', () => { c.destroy(); res(true); }); c.once('error', () => res(false)); });

class XrayProc extends EventEmitter {
  async start(server, { socks = false, validate = false, stats = false } = {}) {
    const bin = binary();
    this.httpPort = await freePort(); this.socksPort = socks ? await freePort() : 0; this.apiPort = stats ? await freePort() : 0;
    const cfg = path.join(app.getPath('temp'), `nova-${crypto.randomBytes(6).toString('hex')}.json`);
    fs.writeFileSync(cfg, JSON.stringify(buildConfig(server, this)), { mode: 0o600 });
    try {
      if (validate) await new Promise((res, rej) => execFile(bin, ['run', '-test', '-c', cfg], { timeout: 10000, windowsHide: true }, (e) => (e ? rej(new Error('تنظیمات این سرور معتبر نیست.')) : res())));
      this.child = spawn(bin, ['run', '-c', cfg], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      procs.add(this); let err = '', exited = false;
      this.child.stderr.on('data', (d) => { err = (err + d).slice(-800); });
      this.child.stdout.on('data', (d) => { err = (err + d).slice(-800); });
      this.child.on('error', () => {});
      this.child.on('exit', (code) => { exited = true; procs.delete(this); this.emit('exit', code); });
      for (let i = 0; i < 60; i++) {
        if (exited) { log.error('xray exited early:', err); throw new Error('هسته Xray اجرا نشد.'); }
        if (await canConnect(this.httpPort)) return this;
        await new Promise((r) => setTimeout(r, 100));
      }
      throw new Error('هسته Xray اجرا نشد.');
    } catch (e) { this.stop(); throw e; }
    finally { fs.unlink(cfg, () => {}); }
  }
  // مجموع بایت‌های ارسال/دریافت از هسته؛ در صورت خطا null
  traffic() {
    return new Promise((res) => {
      if (!this.apiPort) return res(null);
      execFile(binary(), ['api', 'statsquery', `--server=127.0.0.1:${this.apiPort}`, '-pattern', 'outbound>>>proxy>>>traffic'], { timeout: 3000, windowsHide: true }, (e, out) => {
        if (e) return res(null);
        try { const t = { up: 0, down: 0 }; for (const x of JSON.parse(out).stat || []) { if (x.name.endsWith('uplink')) t.up = +x.value || 0; if (x.name.endsWith('downlink')) t.down = +x.value || 0; } res(t); } catch { res(null); }
      });
    });
  }
  stop() { this.removeAllListeners('exit'); try { this.child && this.child.kill(); } catch {} procs.delete(this); }
}
const killAll = () => { for (const p of [...procs]) p.stop(); };
module.exports = { XrayProc, killAll };
