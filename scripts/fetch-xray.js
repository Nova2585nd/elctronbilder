// دانلود Xray-core با نسخه ثابت و بررسی SHA256 از فایل .dgst رسمی همان انتشار
const fs = require('fs'), path = require('path'), crypto = require('crypto'), { execFileSync } = require('child_process');
const VERSION = process.env.XRAY_VERSION || '25.1.30'; // در صورت نیاز با آخرین نسخه پایدار از صفحه Releases جایگزین کنید
const base = `https://github.com/XTLS/Xray-core/releases/download/v${VERSION}/Xray-windows-64.zip`;
const out = path.join(__dirname, '../resources/xray'); const zip = path.join(out, 'xray.zip');
(async () => {
  if (fs.existsSync(path.join(out, 'xray.exe'))) return console.log('xray.exe موجود است.');
  fs.mkdirSync(out, { recursive: true });
  const get = async (u) => { const r = await fetch(u, { redirect: 'follow' }); if (!r.ok) throw new Error(`دانلود ناموفق: ${u} (${r.status})`); return Buffer.from(await r.arrayBuffer()); };
  console.log('در حال دانلود Xray', VERSION); const data = await get(base);
  const dgst = (await get(base + '.dgst')).toString(); const m = /SHA2-256=\s*([0-9a-f]{64})/i.exec(dgst);
  if (!m) throw new Error('فایل dgst قابل خواندن نیست؛ صحت باینری تأیید نشد.');
  const sum = crypto.createHash('sha256').update(data).digest('hex');
  if (sum !== m[1].toLowerCase()) throw new Error('SHA256 با مقدار رسمی نمی‌خواند؛ دانلود رد شد.');
  fs.writeFileSync(zip, data);
  if (process.platform === 'win32') execFileSync('powershell', ['-NoProfile', '-Command', `Expand-Archive -Force -Path '${zip}' -DestinationPath '${out}'`]);
  else execFileSync('unzip', ['-o', zip, '-d', out]);
  fs.unlinkSync(zip); console.log('Xray آماده شد. SHA256 تأیید شد:', sum);
})().catch((e) => { console.error(e.message); process.exit(1); });
