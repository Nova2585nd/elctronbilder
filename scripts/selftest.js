const assert = require('assert'); const { parseContent } = require('../src/main/subscription');
const { buildConfig } = require('../src/main/xray-config'); const sel = require('../src/main/selector');
const vmess = 'vmess://' + Buffer.from(JSON.stringify({ ps: 'A-vmess', add: 'a.example.com', port: '443', id: '11111111-1111-1111-1111-111111111111', net: 'ws', path: '/w', host: 'a.example.com', tls: 'tls' })).toString('base64');
const vless = 'vless://22222222-2222-2222-2222-222222222222@b.example.com:443?type=grpc&security=reality&sni=x.com&pbk=KEY&sid=ab&fp=chrome&serviceName=svc#%D8%B3%D8%B1%D9%88%D8%B1-B';
const trojan = 'trojan://pass123@c.example.com:443?sni=c.example.com#C';
const ss = 'ss://' + Buffer.from('aes-256-gcm:pw').toString('base64') + '@d.example.com:8388#D';
const text = [vmess, vless, trojan, ss, vless, 'hysteria2://x@y:1', 'garbage'].join('\n');
for (const t of [text, Buffer.from(text).toString('base64')]) {
  const r = parseContent(t); assert.strictEqual(r.servers.length, 4, 'dedupe+parse'); assert.strictEqual(r.unsupported, 2);
}
const { servers } = parseContent(text); assert.strictEqual(servers[1].name, 'سرور-B');
for (const s of servers) { const c = buildConfig(s, { httpPort: 1, socksPort: 2 }); assert.ok(c.outbounds[0].protocol && c.inbounds.length === 2); }
assert.strictEqual(buildConfig(servers[1], { httpPort: 1 }).outbounds[0].streamSettings.security, 'reality');
const [a, b, c] = servers; const stats = { [a.uid]: { status: 'ok', latency: 90 }, [b.uid]: { status: 'ok', latency: 40 }, [c.uid]: { status: 'fail', fails: 3 } };
assert.strictEqual(sel.recommended(servers, stats), b.uid);
assert.strictEqual(sel.defaultServer(servers, stats, a.uid), a.uid, 'آخرین سرور موفق حتی با پینگ بیشتر پیش‌فرض می‌ماند');
assert.strictEqual(sel.defaultServer(servers, stats, c.uid), b.uid, 'سرور خراب پیش‌فرض نمی‌ماند');
console.log('همه تست‌های خالص موفق بودند.');
// بررسی حضور لوگو در برنامه
const fs = require('fs'), path = require('path'); const R = (p) => path.join(__dirname, '..', p);
assert.ok(fs.statSync(R('assets/logo.svg')).size > 500, 'logo.svg موجود نیست');
const html = fs.readFileSync(R('src/renderer/index.html'), 'utf8');
assert.ok((html.match(/assets\/logo\.svg/g) || []).length >= 2, 'لوگو باید در صفحه خوشامد و هدر باشد');
assert.ok(fs.readFileSync(R('package.json'), 'utf8').includes('assets/icon.png'));
const cc = buildConfig(servers[0], { httpPort: 1, apiPort: 3 }); assert.ok(cc.api && cc.stats && cc.routing.rules[0].inboundTag[0] === "api");
console.log('لوگو و پیکربندی آمار ترافیک تأیید شد.');
