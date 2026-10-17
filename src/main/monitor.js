const http = require('http'), net = require('net');
const { XrayProc } = require('./xray');
const { FALLBACK } = require('./selector');

// تأخیر واقعی از مسیر پروکسی؛ نه ICMP
function probe(port, url, timeout) {
  return new Promise((res) => {
    const u = new URL(url), t0 = Date.now();
    const req = http.request({ host: '127.0.0.1', port, method: 'GET', path: url, headers: { Host: u.host, 'User-Agent': 'NovaConnect', Connection: 'close' }, timeout }, (r) => {
      r.resume(); r.on('end', () => res(r.statusCode === 204 || r.statusCode === 200 ? Date.now() - t0 : null)); r.on('error', () => res(null));
    });
    req.on('timeout', () => { req.destroy(); res(null); }); req.on('error', () => res(null)); req.end();
  });
}
async function probeAny(port, urls, timeout = 8000) { for (const u of urls) { const ms = await probe(port, u, timeout); if (ms != null) return ms; } return null; }
const tcpOk = (host, port) => new Promise((res) => { const c = net.connect({ host, port, timeout: 4000 }); c.once('connect', () => { c.destroy(); res(true); }); c.once('timeout', () => { c.destroy(); res(false); }); c.once('error', () => res(false)); });

async function testServer(server, urls) {
  const p = new XrayProc();
  try {
    await p.start(server);
    const a = await probeAny(p.httpPort, urls, 7000);
    if (a == null) return null;
    const b = await probe(p.httpPort, urls[0], 5000);
    return b == null ? a : Math.min(a, b);
  } catch { return null; } finally { p.stop(); }
}
async function testAll(servers, testUrl, onResult, concurrency = 4) {
  const urls = [testUrl, FALLBACK].filter((v, i, a) => v && a.indexOf(v) === i);
  const results = new Map(); let i = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, servers.length) }, async () => {
    while (i < servers.length) {
      const s = servers[i++]; const ms = await testServer(s, urls);
      results.set(s.uid, ms); onResult(s, ms ?? null, false);
    }
  }));
  // اگر هیچ سروری پاسخ نداد، ممکن است مقصد آزمایشی خراب باشد؛ با TCP تفکیک می‌کنیم
  if (servers.length && [...results.values()].every((v) => v == null)) {
    for (const s of servers) if (await tcpOk(s.address, s.port)) onResult(s, null, true);
  }
}
module.exports = { probe, probeAny, testAll };
