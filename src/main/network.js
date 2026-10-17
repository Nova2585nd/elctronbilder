const { execFile } = require('child_process');
const KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings';
const run = (cmd, args) => new Promise((res, rej) => execFile(cmd, args, { windowsHide: true, timeout: 15000 }, (e, out) => (e ? rej(e) : res(out))));
const query = async (name) => { try { const m = /REG_\w+\s+(.*)\s*$/m.exec(await run('reg', ['query', KEY, '/v', name])); return m ? m[1].trim() : null; } catch { return null; } };
const REFRESH = '$s=\'[DllImport("wininet.dll")]public static extern bool InternetSetOption(IntPtr h,int o,IntPtr b,int l);\';$t=Add-Type -MemberDefinition $s -Name W -Namespace N -PassThru;$t::InternetSetOption([IntPtr]::Zero,39,[IntPtr]::Zero,0)|Out-Null;$t::InternetSetOption([IntPtr]::Zero,37,[IntPtr]::Zero,0)|Out-Null';
const refresh = () => run('powershell', ['-NoProfile', '-NonInteractive', '-Command', REFRESH]).catch(() => {});
async function setVal(name, type, v) { if (v == null) await run('reg', ['delete', KEY, '/v', name, '/f']).catch(() => {}); else await run('reg', ['add', KEY, '/v', name, '/t', type, '/d', String(v), '/f']); }

// store: شیء ذخیره‌سازی؛ پشتیبان تنظیمات قبلی برای بازیابی بعد از خروج یا کرش ذخیره می‌شود
async function enable(store, save, httpPort) {
  if (process.platform !== 'win32') throw new Error('تنظیم مسیر شبکه فقط در ویندوز پشتیبانی می‌شود.');
  try {
    if (!store.proxyOwned) store.proxyBackup = { enable: await query('ProxyEnable'), server: await query('ProxyServer'), override: await query('ProxyOverride') };
    store.proxyOwned = true; save();
    await setVal('ProxyServer', 'REG_SZ', `127.0.0.1:${httpPort}`);
    await setVal('ProxyOverride', 'REG_SZ', 'localhost;127.*;10.*;192.168.*;<local>');
    await setVal('ProxyEnable', 'REG_DWORD', 1);
    await refresh();
  } catch { throw new Error('دسترسی لازم برای تنظیم شبکه وجود ندارد.'); }
}
async function restore(store, save) {
  if (!store.proxyOwned || process.platform !== 'win32') { store.proxyOwned = false; return; }
  const b = store.proxyBackup || {};
  const en = b.enable == null ? 0 : parseInt(b.enable, 16) || parseInt(b.enable, 10) || 0;
  await setVal('ProxyEnable', 'REG_DWORD', en).catch(() => {});
  await setVal('ProxyServer', 'REG_SZ', b.server).catch(() => {});
  await setVal('ProxyOverride', 'REG_SZ', b.override).catch(() => {});
  await refresh(); store.proxyOwned = false; store.proxyBackup = null; save();
}
module.exports = { enable, restore };
