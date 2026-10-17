// دریافت و تجزیه اشتراک؛ فقط داده تجزیه می‌شود و هیچ کدی اجرا نمی‌شود
const crypto = require('crypto');
const b64 = (s) => Buffer.from(String(s).trim().replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
const dec = (s) => { try { return decodeURIComponent(s); } catch { return s; } };

function fin(o, name) {
  if (!o.address || !(o.port > 0 && o.port < 65536)) return null;
  if (o.protocol === 'shadowsocks' ? !(o.method && o.password) : o.protocol === 'trojan' ? !o.password : !o.id) return null;
  const key = [o.protocol, o.address, o.port, o.id || o.password, o.network, o.path, o.serviceName, o.tls, o.pbk].join('|');
  o.uid = crypto.createHash('sha1').update(key).digest('hex').slice(0, 16);
  o.name = (name && String(name).trim()) || `${o.address}:${o.port}`;
  return o;
}
function parseLink(link) {
  link = link.trim(); const proto = link.split('://')[0].toLowerCase();
  try {
    if (proto === 'vmess') {
      const j = JSON.parse(b64(link.slice(8)));
      return fin({ protocol: 'vmess', address: j.add, port: +j.port, id: j.id, security: j.scy || 'auto', network: j.net || 'tcp', path: j.path, host: j.host,
        tls: j.tls === 'tls' ? 'tls' : 'none', sni: j.sni || j.host, fp: j.fp, alpn: j.alpn, headerType: j.type, serviceName: j.path }, j.ps);
    }
    if (proto === 'ss') {
      let rest = link.slice(5), name = ''; const h = rest.indexOf('#');
      if (h >= 0) { name = dec(rest.slice(h + 1)); rest = rest.slice(0, h); }
      rest = rest.split('?')[0].replace(/\/$/, '');
      let cred, hp;
      if (rest.includes('@')) { const i = rest.lastIndexOf('@'); cred = rest.slice(0, i); hp = rest.slice(i + 1); cred = cred.includes(':') ? dec(cred) : b64(cred); }
      else { const d = b64(rest), i = d.lastIndexOf('@'); cred = d.slice(0, i); hp = d.slice(i + 1); }
      const ci = cred.indexOf(':'), pi = hp.lastIndexOf(':');
      return fin({ protocol: 'shadowsocks', method: cred.slice(0, ci), password: cred.slice(ci + 1), address: hp.slice(0, pi).replace(/[[\]]/g, ''), port: +hp.slice(pi + 1), network: 'tcp', tls: 'none' }, name);
    }
    if (proto === 'vless' || proto === 'trojan') {
      const u = new URL(link), q = u.searchParams, user = dec(u.username);
      return fin({ protocol: proto, id: proto === 'vless' ? user : undefined, password: proto === 'trojan' ? user : undefined,
        address: u.hostname.replace(/[[\]]/g, ''), port: +u.port, network: q.get('type') || 'tcp', tls: q.get('security') || (proto === 'trojan' ? 'tls' : 'none'),
        sni: q.get('sni') || q.get('host') || undefined, host: q.get('host') || undefined, path: q.get('path') || undefined, fp: q.get('fp') || undefined,
        alpn: q.get('alpn') || undefined, flow: q.get('flow') || undefined, pbk: q.get('pbk') || undefined, sid: q.get('sid') || undefined, spx: q.get('spx') || undefined,
        serviceName: q.get('serviceName') || undefined, mode: q.get('mode') || undefined, headerType: q.get('headerType') || undefined,
        allowInsecure: q.get('allowInsecure') === '1' || q.get('insecure') === '1' }, dec(u.hash.slice(1)));
    }
  } catch {}
  return null;
}
function parseContent(text) {
  text = text.trim();
  if (!text.includes('://')) { try { text = b64(text); } catch {} }
  const seen = new Map(); let unsupported = 0;
  for (const line of text.split(/\r?\n/)) {
    const l = line.trim(); if (!l) continue;
    const s = parseLink(l); if (s) seen.set(s.uid, s); else unsupported++;
  }
  return { servers: [...seen.values()], unsupported };
}
async function fetchSubscription(url) {
  let u; try { u = new URL(url.trim()); } catch { throw new Error('لینک اشتراک معتبر نیست.'); }
  if (!/^https?:$/.test(u.protocol)) throw new Error('لینک اشتراک معتبر نیست.');
  let res;
  try { res = await fetch(u, { headers: { 'User-Agent': 'NovaConnect/1.0' }, signal: AbortSignal.timeout(20000), redirect: 'follow' }); }
  catch (e) { throw new Error(e.name === 'TimeoutError' ? 'زمان دریافت اشتراک تمام شد.' : 'دریافت اشتراک ناموفق بود. اینترنت را بررسی کنید.'); }
  if (!res.ok) throw new Error(`دریافت اشتراک ناموفق بود (کد ${res.status}).`);
  const text = await res.text();
  if (!text.trim()) throw new Error('اشتراک خالی است.');
  if (text.length > 5e6) throw new Error('اشتراک بیش از حد بزرگ است.');
  const r = parseContent(text);
  if (!r.servers.length) throw new Error('اشتراک هیچ سرور قابل‌استفاده‌ای ندارد.');
  return r;
}
module.exports = { parseLink, parseContent, fetchSubscription };
